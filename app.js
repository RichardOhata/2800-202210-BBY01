"use strict";
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const fs = require("fs");
const {
    JSDOM
} = require('jsdom');
const path = require('path');
const {
    res
} = require('express');
const multer = require("multer");
const {
    connect
} = require('http2');
const ConnectionConfig = require('mysql/lib/ConnectionConfig');
const app = express();


app.use("/img", express.static("./images"));
app.use("/css", express.static("./styles"));
app.use("/js", express.static("./js"));
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, 'static')));

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, "./images/")
    },
    filename: function (req, file, callback) {
        callback(null, "my-app-" + file.originalname.split('/').pop().trim());
    }
});

const upload = multer({
    storage: storage
});

// Variable to determine if db connection is remote or local
const is_heroku = process.env.IS_HEROKU || false;

// Local Database
const dbConfigLocal = {
    host: 'localhost',
    user: 'root',
    password: '',
    multipleStatements: true,
    database: 'COMP2800'
};

// Remote Database
const dbConfigHeroku = {
    host: "us-cdbr-east-05.cleardb.net",
    user: "b459ce75b586dd",
    password: "7790c83a",
    multipleStatements: true,
    database: "heroku_7ab302bab529edd"
};

app.get('/', (req, res) => {
    if (!req.session.loggedin) {
        let doc = fs.readFileSync('./login.html', "utf-8");
        res.send(doc);
    } else {
        res.redirect('/home');
    }
});

app.get('/signup', (req, res) => {
    let doc = fs.readFileSync('./signup.html', "utf-8");
    res.send(doc);
})


app.post('/auth', (req, res) => {
    if (is_heroku) {
        var database = mysql.createConnection(dbConfigHeroku);
    } else {
        var database = mysql.createConnection(dbConfigLocal);
    }
    // Capture the input fields
    let username = req.body.username;
    let password = req.body.password;
    // Ensure the input fields exists and are not empty
    if (username && password) {
        // Execute SQL query that'll select the account from the database based on the specified username and password
        database.query('SELECT * FROM BBY_01_user WHERE username = ? AND password = ?',
            [username, password],
            function (error, results, fields) {

                // If there is an issue with the query, output the error
                if (error) throw error;
                // If the account exists
                if (results.length > 0 && results[0].isAdmin == 1) {
                    // Authenticate the user
                    req.session.loggedin = true;
                    req.session.username = username;
                    req.session.isAdmin = results[0].isAdmin;
                    req.session.userid = results[0].ID;

                    // Redirect to admin page
                    res.send({
                        status: "success",
                        msg: "Logged in."
                    });

                } else if (results.length > 0) {
                    // Authenticate the user
                    req.session.loggedin = true;
                    req.session.username = username;
                    req.session.isAdmin = results[0].isAdmin;
                    req.session.userid = results[0].ID;

                    // Redirect to home page
                    res.send({
                        status: "success",
                        msg: "Logged in."
                    });
                } else {
                    // Print Error Message
                    res.send({
                        status: "fail",
                        msg: "User account not found."
                    });
                }
                res.end();
            });
    } else {
        // Print Error Message
        res.send({
            status: "empty",
            msg: "Username and Password cannot be empty."
        });
        res.end();
    }
});

app.post('/check-account', (req, res) => {
    if (is_heroku) {
        var database = mysql.createConnection(dbConfigHeroku);
    } else {
        var database = mysql.createConnection(dbConfigLocal);
    }
    let username = req.body.username;
    let email = req.body.email;
    let password = req.body.password;
    let checkUsername = false;
    let checkEmail = false;

    if (username && password && email) {
        database.query('SELECT * from bby_01_user', (error, results) => {
            if (error) throw error
            for (let i = 0; i < results.length; i++) {
                if (results[i].username == username) {
                    checkUsername = true;
                    break;
                }
            }
            for (let i = 0; i < results.length; i++) {
                if (results[i].email == email) {
                    checkEmail = true;
                    break;
                }
            }
            if (checkEmail) {
                res.send({
                    status: "email existed",
                    msg: "You already signed up with the email."
                });
            } else if (checkUsername) {
                res.send({
                    status: "invalid username",
                    msg: "Someone already use the username."
                });
            } else {
                res.send({
                    status: "success",
                    msg: "Signed up"
                });
            }
            res.end();
        });
    } else {
        res.send({
            status: "empty",
            msg: "Username Password and email cannot be empty"
        });
        res.end();
    }


})

app.get('/home', (req, res) => {

    // If the user is logged in
    if (req.session.loggedin) {
        let profile = fs.readFileSync("./main.html", "utf8");
        let profileDOM = new JSDOM(profile);
        profileDOM.window.document.getElementById("greetUser").innerHTML = "Hello, " + req.session.username;
        if (req.session.isAdmin == 0) {
            profileDOM.window.document.getElementById("dBoard").remove();
            profileDOM.window.document.getElementById("dashboard-icon").remove();
            
        }
        res.send(profileDOM.serialize());
    } else {
        // If the user is not logged in
        res.redirect("/");
    }

    res.end();
});

app.get('/admin', (req, res) => {
    // If the user is logged in
    if (req.session.loggedin && req.session.isAdmin > 0) {
        // Render login template
        let doc = fs.readFileSync('./users.html', "utf-8");
        res.send(doc);
    } else {
        // If the user is not logged in
        res.redirect("/home");

    }
    res.end();
});

app.get('/profile', (req, res) => {
    // If the user is logged in
    if (req.session.loggedin) {
        if (is_heroku) {
            var database = mysql.createConnection(dbConfigHeroku);
        } else {
            var database = mysql.createConnection(dbConfigLocal);
        }
        const sql = ` INSERT INTO profile(userID, displayName, about, profilePic)
        SELECT * FROM (SELECT ? AS userID, '' AS displayName, '' AS about, 'logo-04.png' AS profilePic) AS tmp
        WHERE NOT EXISTS (SELECT userID
                            FROM profile
                            WHERE userID = ?) LIMIT 1;`;
        database.connect();
        database.query(sql, [req.session.userid, req.session.userid], (error, results, fields) => {
            if (error) {
                console.log(error);
            }
        });
        database.end();
        let doc = fs.readFileSync('./profile.html', "utf8");
        let profileDOM = new JSDOM(doc);
        if (req.session.isAdmin == 0) {
            profileDOM.window.document.querySelector("#dashboard").remove();
        }
        profileDOM.window.document.getElementById("uName").innerHTML = req.session.username + "'s Profile";
        res.send(profileDOM.serialize());
    } else {
        // If the user is not logged in
        res.redirect("/");
    }
});

app.get('/update-profile', (req, res) => {
    // If the user is loggedin
    if (req.session.loggedin) {
        let doc = fs.readFileSync('./update-profile.html', "utf-8");
        let profileDOM = new JSDOM(doc);
        if (req.session.isAdmin == 0) {
            profileDOM.window.document.querySelector("#dashboard").remove();
        }
        profileDOM.window.document.getElementById("uName").innerHTML = req.session.username;
        res.send(profileDOM.serialize());
    } else {
        // If the user is not logged in
        res.redirect("/");
    }
})

app.post('/upload-images', upload.array("files"), (req, res) => {
    if (is_heroku) {
        var database = mysql.createConnection(dbConfigHeroku);
    } else {
        var database = mysql.createConnection(dbConfigLocal);
    }
    const sql = `UPDATE profile
                SET profilePic = ?
                WHERE userID = ?`;
    database.connect();
    database.query(sql, [req.files[0].filename, req.session.userid], (error, results) => {
        if (error) console.log(error);
        res.send({
            status: "success",
            rows: results
        });
    });
});

app.get('/get-displayname', (req, res) => {
    // If the user is loggedin
    if (req.session.loggedin) {
        if (is_heroku) {
            var database = mysql.createConnection(dbConfigHeroku);
        } else {
            var database = mysql.createConnection(dbConfigLocal);
        }
        const sql = `SELECT * 
                FROM profile 
                WHERE userID = ?`;
        database.connect();
        database.query(sql, [req.session.userid], (error, results) => {
            if (error) console.log(error);
            res.send({
                status: "success",
                rows: results
            });
        });
        database.end();
    } else {
        // If the user is not logged in
        res.redirect("/");
    }
});

app.get('/get-about', (req, res) => {
    // If the user is loggedin
    if (req.session.loggedin) {
        if (is_heroku) {
            var database = mysql.createConnection(dbConfigHeroku);
        } else {
            var database = mysql.createConnection(dbConfigLocal);
        }

        const sql = `SELECT * 
                FROM profile 
                WHERE userID = ?`;
        database.connect();
        database.query(sql, [req.session.userid], (error, results) => {
            if (error) console.log(error);
            res.send({
                status: "success",
                rows: results
            });
        });
        database.end();
    } else {
        // If the user is not logged in
        res.redirect("/");
    }
});

app.get('/get-profilePic', (req, res) => {
    if (req.session.loggedin) {
        if (is_heroku) {
            var database = mysql.createConnection(dbConfigHeroku);
        } else {
            var database = mysql.createConnection(dbConfigLocal);
        }

        const sql = `SELECT *
                    FROM profile
                    WHERE userID = ?`;
        database.connect();
        database.query(sql, [req.session.userid], (error, results) => {
            if (error) console.log(error);
            res.send({
                status: "success",
                rows: results
            });
        });
        database.end();
    } else {
        res.redirect("/");
    }
});

app.get('/get-username', (req, res) => {
    if (req.session.loggedin) {
        if (is_heroku) {
            var database = mysql.createConnection(dbConfigHeroku);
        } else {
            var database = mysql.createConnection(dbConfigLocal);
        }

        const sql = `SELECT * 
                FROM bby_01_user 
                WHERE ID = ?`;
        database.connect();
        database.query(sql, [req.session.userid], (error, results) => {
            if (error) console.log(error);
            res.send({
                status: "success",
                rows: results
            });
        });
        database.end();
    } else {
        // If the user is not logged in
        res.redirect("/");
    }
});

app.post('/update-profile', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (is_heroku) {
        var database = mysql.createConnection(dbConfigHeroku);
    } else {
        var database = mysql.createConnection(dbConfigLocal);
    }
    let newName = req.body.displayName;
    let newAbout = req.body.about;
    let newEmail = req.body.email;
    let newPassword = req.body.password;
    let sql;
    let message = "Profile updated.";
    database.connect();

    if (newAbout != '') {
        sql = `UPDATE profile
                SET about = ?
                WHERE userID = ?`;
        database.query(sql, [newAbout, req.session.userid],
            (error, results, fields) => {
                if (error) console.log(error);
                message = "About updated."
            });
    }
    if (newName != '') {
        sql = `UPDATE profile
                SET displayName = ?
                WHERE userID = ?`;
        database.query(sql, [newName, req.session.userid],
            (error, results, fields) => {
                if (error) console.log(error);
                message = "Display name updated."
            });
    }
    if (newEmail != '') {
        sql = `UPDATE bby_01_user
                SET email = ?
                WHERE ID = ?`;
        database.query(sql, [newEmail, req.session.userid], (error, results, fields) => {
            if (error) console.log(error);
            message = "Email updated."
        });
    }
    if (newPassword != '') {
        sql = `UPDATE bby_01_user
                SET password = ?
                WHERE ID = ?`;
        database.query(sql, [newPassword, req.session.userid], (error, results, fields) => {
            if (error) console.log(error);
            message = "Password updated."
        })
    }
    res.send({
        status: "success",
        msg: message
    });


    database.end();

});

app.get('/get-users', (req, res) => {
    // If the user is logged in
    if (req.session.loggedin) {
        if (is_heroku) {
            var database = mysql.createConnection(dbConfigHeroku);
        } else {
            var database = mysql.createConnection(dbConfigLocal);
        }
        database.connect();
        database.query('SELECT * FROM BBY_01_user', (error, results) => {
            if (error) console.log(error);
            res.send({
                status: "success",
                rows: results
            });
        });
        database.end();
    } else {
        // If the user is not logged in
        res.redirect("/");
    }
});

app.post('/add-user', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (is_heroku) {
        var database = mysql.createConnection(dbConfigHeroku);
    } else {
        var database = mysql.createConnection(dbConfigLocal);
    }
    database.connect();
    database.query('INSERT INTO BBY_01_user (username, email, password, isAdmin) values(?, ?, ?, ?)',
        [req.body.username, req.body.email, req.body.password, req.body.isAdmin],
        (error, results, fields) => {
            if (error) console.log(error);
            res.send({
                status: "success",
                msg: "Record added."
            });
        });
    database.end();
});

app.post('/update-user', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (is_heroku) {
        var database = mysql.createConnection(dbConfigHeroku);
    } else {
        var database = mysql.createConnection(dbConfigLocal);
    }
    database.connect();
    database.query('UPDATE BBY_01_user SET username = ?, email = ?, password = ?, isAdmin = ? WHERE ID = ?',
        [req.body.username, req.body.email, req.body.password, req.body.isAdmin, req.body.id],
        (error, results) => {
            if (error) console.log(error);

            res.send({
                status: "success",
                msg: "Recorded updated."
            });
        });
    database.end();
})

app.post('/delete-user', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (is_heroku) {
        var database = mysql.createConnection(dbConfigHeroku);
    } else {
        var database = mysql.createConnection(dbConfigLocal);
    }

    database.connect();
    let adminLeft = `SELECT *
                    FROM BBY_01_user
                    WHERE isAdmin = 1`;
    let checkAdmin = `SELECT isAdmin
                    FROM bby_01_user
                    WHERE ID = ?`;
    var numberOfAdmin;
    var accountType;
    database.query(checkAdmin, [req.body.id], (error, results) => {
        if (error) console.log(error);
        accountType = results[0].isAdmin;
    });
    database.query(adminLeft, (error, results) => {
        if (error) console.log(error);
        numberOfAdmin = results.length;
        if (numberOfAdmin == 1 && accountType == 1) {
            res.send({
                status: "fail",
                msg: "The account is the last admin account."
            });
        } else {
            deleteSQL(req, res);
        }
    });
    database.end();
});

function deleteSQL(req, res) {
    if (is_heroku) {
        var database = mysql.createConnection(dbConfigHeroku);
    } else {
        var database = mysql.createConnection(dbConfigLocal);
    }
    database.connect();
    let deleteSql = `DELETE 
                    FROM BBY_01_user 
                    WHERE ID = ?`;
    database.query(deleteSql,
        [req.body.id],
        (error, results) => {
            if (error) console.log(error);

            res.send({
                status: "success",
                msg: "Record deleted"
            });
        });
}

app.get("/logout", (req, res) => {
    // If the user is logged in
    if (req.session) {
        req.session.destroy(function (error) {
            if (error) {
                res.status(400).send("Unable to log out")
            } else {
                // session deleted, redirect to home
                res.redirect("/");
            }
        });
    }
});

var connection;

function handleDisconnect() {
  connection = mysql.createConnection(db_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connection.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connection.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}

handleDisconnect();

// RUN SERVER REMOTELY
if (is_heroku) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log('Server is running on port ' + PORT + ' .');
    });
} else {
    // RUN SERVER LOCALLY
    let port = 8000;
    app.listen(port, () => {
        console.log("Listening on port " + port + "!");
    })

}