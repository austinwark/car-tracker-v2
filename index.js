require("dotenv").config();
const express = require("express");
const mysql = require("mysql");
const session = require("express-session");

const { authMiddleware, validateAuthFormData, getAllUsersController, getActiveUser,
  changePassword, logout, login, confirmEmail,
  resendEmailConfirmation, registration, unsubscribeUserEmail } = require("./controllers/authController");
const { getAllQueries, getSingleQuery, deleteSingleQuery, refreshResults, saveNewQuery, getSortedResults, emailResults, emailSingleResult  } = require("./controllers/mainController");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(express.static(__dirname + "/public"));

const oneDay = 1000 * 60 * 60 * 24;
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: false,
  cookie: { maxAge: oneDay }
}));

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: true
});

connection.connect();

/* --- START Views --- */

/* Sends registration view */
app.get("/registration", (req, res) => {
  res.sendFile(__dirname + "/registration.html");
});

/* Sends login view */
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

/* Sends homepage view after authentication */
app.get("/", authMiddleware, (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

/* --- END Views --- */

/* --- START Authentication */

/* Called by /login and /registration to validate form data before submitting form. */
app.post("/api/users/auth", validateAuthFormData);

/* Called by /login and /registration to get all users to validate form data before submitting form. */
app.get("/api/users/all", getAllUsersController);

/* Used to get logged-in user's email from session */
app.get("/api/users/active", getActiveUser);

/* Called to change user's password */
app.post("/api/users/changePassword", changePassword)

/* Logs user out */
app.get("/logout", logout);

/* Called on login form submit. Validates form data one more time. */
app.post("/login", login);

/* Confirms user's email address (sets emailVerified to true) */
app.get("/api/users/verify/:confirmationCode", confirmEmail);

/* Called to resend email confirmation link */
app.get("/api/users/resend-verification", resendEmailConfirmation);

/* Called on registration form submit. Validates form data one more time. */
app.post("/registration", registration);

/* Called by clicking unsubscribe link in results email. Switches the user's emailVerified status to false */
app.get("/api/users/unsubscribe/:confirmationCode", unsubscribeUserEmail);

/* --- END Authentication */

/* --- START Homepage --- */

app.get("/api/queries/all", authMiddleware, getAllQueries);

app.get("/api/queries/:queryId", authMiddleware, getSingleQuery);

app.delete("/api/queries/delete/:queryId", authMiddleware, deleteSingleQuery);

app.get("/api/results/refresh/:queryId", authMiddleware, refreshResults);

// TODO: MAKE SURE NUMBEROFRESULTS ARE SAVED EACH TIME RESULTS ARE SCRAPED
app.post("/api/queries/submit", authMiddleware, saveNewQuery);

app.get("/api/results/:queryId/:sortBy/:sortOrder", authMiddleware, getSortedResults);

app.post("/api/results/email", emailResults);

app.post("/api/results/email/single", emailSingleResult);

/* --- END Homepage --- */

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log("Express server started at port 3000."));
module.exports = server;