require("dotenv").config();
const mysql = require("mysql");
const session = require("express-session");
const Mailer = require("../utils/mailer.js");

const { getAllUsers, getHashedPassword, saveNewUser, saveResults,
  fetchResults, resetEmailConfirmation, parseJson, isJson } = require("../utils/serverHelperFunctions");

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: true
});

connection.connect();

/* Authentication middleware to check session before proceeding to next call */
exports.authMiddleware = (req, res, next) => {

  if (!req.session || !req.session.email || !req.session.userId) {
    res.redirect("/login");
    return;
  }
    
  getAllUsers().then(users => {

    const user = users.find(user => user.email.toLowerCase() === req.session.email.toLowerCase());
    if (user) {
      req.session.emailVerified = true;
      return next();
    } else {
      res.redirect("/login");
    }
  });
}

exports.validateAuthFormData = (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = getHashedPassword(password);

  const sqlQuery = mysql.format("SELECT * FROM users WHERE email = ?",
    [email.toLowerCase()]);
  connection.query(sqlQuery, (err, results) => {
    if (err) {
      console.log(err);
      res.status(406).send("Server error, please try again later.");
    } else if (results.length == 0) {
      res.status(401).send("Account with that email does not exist.");
    } else {
      const user = results[0];
      if (hashedPassword === user.password) {
        res.status(200).send();
      } else {
        res.status(401).send("Password is not valid.");
      }
    }
  });
}

exports.getAllUsersController = (req, res) => {
  getAllUsers().then(results => {
    res.status(200).send({ results });
  });
}

exports.getActiveUser = (req, res) => {
  if (req.session && req.session.email) {
    const sqlQuery = mysql.format("SELECT * FROM users WHERE email = ?",
    [req.session.email]);
    connection.query(sqlQuery, (err, results) => {
      if (err) {
        console.log(err);
      } else {
        const user = results[0];
        if (user) {
          res.status(200).send({ user });
        }
      }
    })
  }
  // if (req.session && req.session.email) {
  //   res.status(200).send({ email: req.session.email, emailVerified: req.session.emailVerified });
  // }
}

exports.changePassword = (req, res) => {
  const { password, confirmPassword } = req.body;
  if (req.session && req.session.email) {

    const hashedPassword = getHashedPassword(password);
    const sqlQuery = mysql.format("UPDATE users SET password = ? WHERE email = ?",
    [hashedPassword, req.session.email]);
    connection.query(sqlQuery, (err, results) => {
      if (err) {
        console.log(err);
        res.redirect("/?auth=err");
      } else {
        res.redirect("/?auth=success")
      }
    });
  } else {
    res.redirect("/login");
  }
}

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect("/login");
}

exports.login = (req, res) => {
  const { email, password } = req.body;
  const rememberMe = req.body.rememberMe ? true : false;
  const hashedPassword = getHashedPassword(password);

  const sqlQuery = mysql.format("SELECT * FROM users WHERE email = ?",
    [email.toLowerCase()]);
  connection.query(sqlQuery, (err, results) => {
    if (err) {
      res.redirect("/login?err=406");
    } else if (results.length == 0) {
      res.redirect("/login?err=404");
    } else {
      const user = results[0];
      const confirmationCode = user.emailConfirmationCode;
      if (hashedPassword === user.password) {
        req.session.email = email.toLowerCase();
        req.session.userId = user.userId;

        const twoWeeks = 1210000000; // two weeks in milliseconds
        if (rememberMe)
          req.session.cookie.maxAge = twoWeeks; // set session cookie expiration date to two weeks if user chooses to stay logged in
          
        res.status(200).redirect("/");
      } else {
        res.redirect("/login?err=401");
      }
    }
  });
}

exports.confirmEmail = (req, res) => {
  const confirmationCode = req.params.confirmationCode;
  let sqlQuery = mysql.format("SELECT * FROM users WHERE emailConfirmationCode = ?",
    [confirmationCode]);
  
  connection.query(sqlQuery, (err, results) => {
    if (err) {
      console.log(err);
      res.sendFile(__dirname + "/confirmationError.html");
    } else {

      const user = results[0];
      sqlQuery = mysql.format("UPDATE users SET emailVerified = true WHERE userId = ?",
      [user.userId]) ;
      connection.query(sqlQuery, (err, results) => {
        if (err) {
          console.log(err);
          res.sendFile(__dirname + "/confirmationError.html");
        } else {
          res.sendFile(__dirname + "/confirmationSuccess.html");
        }
      });
    }
  });
}

exports.resendEmailConfirmation = (req, res) => {
  if (req.session && req.session.email) {
    const email = req.session.email;
    const sqlQuery = mysql.format("SELECT * FROM users WHERE email = ?",
    [email]);
    connection.query(sqlQuery, (err, results) => {
      if (err) {
        console.log(err);
      }

      const user = results[0];
      if (user) {
        const confirmationCode = user.emailConfirmationCode;
        const mailer = new Mailer();
        mailer.sendConfirmationEmail(email, confirmationCode);
        res.status(200).send();
      }
      // ELSE

    });
  }
}

exports.registration = (req, res) => {
  const { email, password, confirmPassword } = req.body;
  saveNewUser(email, password).then(() => {
    res.redirect("/login?newUser=true");
  }).catch(() => {
    res.redirect("/registration?err=406");
  });
}

exports.unsubscribeUserEmail = (req, res) => {

  // Find the user in DB using the same confirmationCode used to verify the user's email address
  const confirmationCode = req.params.confirmationCode;
  const sqlQuery = mysql.format("SELECT * FROM users WHERE emailConfirmationCode = ?",
    [confirmationCode]);
  connection.query(sqlQuery, (err, results) => {
    if (err) {
      console.log(err);
      res.sendFile(__dirname + "/unsubscribeError.html");
      return;
    }

    const user = results[0];
    const { userId } = user;
    // Switch user's emailVerified status to false and show confirmation/error page */
    resetEmailConfirmation(userId).then(() => {
      // Had to include unsubscribeSuccess.html (and unsubscribeError.html) in 
      // the same directory as this controller file as a hack around a bug
      res.sendFile(__dirname + "/unsubscribeSuccess.html");
    }).catch(err => {
      console.log(err);
      res.sendFile(__dirname + "/unsubscribeError.html");
    });
  });
}


