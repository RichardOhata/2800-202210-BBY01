const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const fs = require("fs");
const {JSDOM} = require('jsdom');
const path = require('path');
const app = express();


app.use("/css", express.static("../styles"));

const connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'talkit'
});

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));

app.get('/', function(request, response) {
	// Render login template
    let doc = fs.readFileSync('../login.html', "utf-8");
    response.send(doc);
});

app.post('/auth', function(request, response) {
	// Capture the input fields
	let username = request.body.username;
	let password = request.body.password;
	// Ensure the input fields exists and are not empty
	if (username && password) {
		// Execute SQL query that'll select the account from the database based on the specified username and password
		connection.query('SELECT * FROM user WHERE name = ? AND password = ?', [username, password], function(error, results, fields) {
			// If there is an issue with the query, output the error
			if (error) throw error;
			// If the account exists
			if (results.length > 0) {
				// Authenticate the user
				request.session.loggedin = true;
				request.session.username = username;
				// Redirect to home page
				response.redirect('/home');
				
			} else {
				response.send('Incorrect Username and/or Password!');
			}			
			response.end();
		});
	} else {
		response.send('Please enter Username and Password!');
		response.end();
	}
});

app.get('/home', function(request, response) {
	// If the user is loggedin
	if (request.session.loggedin) {
		
		let profile = fs.readFileSync("./profile.html", "utf8");
        let profileDOM = new JSDOM(profile);
		response.send(profileDOM.serialize());
	} else {
		// If the user is not logged in
		response.redirect("/");
	}
	response.end();
});

let port = 8000;
app.listen(port, function () {
    console.log('Test app listening on port ' + port + '!');
  })