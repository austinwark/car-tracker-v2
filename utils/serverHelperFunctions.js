require("dotenv").config();
const mysql = require("mysql");
const crypto = require("crypto");
const session = require("express-session");
const uuid = require("uuid");
const Scraper = require("./scraper.js");
const Mailer = require("./mailer.js");

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: true
});

connection.connect();

/* Fetches all users */
exports.getAllUsers = () => {
  return new Promise((resolve, reject) => {
    const sqlQuery = "SELECT * FROM users";
    connection.query(sqlQuery, (err, results) => {
      if (err) {
        console.log(err);
        reject();
      } else {
        resolve(results);
      }
    });
  });
}

exports.findUserByEmail = email => {
  return new Promise((resolve, reject) => {

    const sqlQuery = mysql.format("SELECT * FROM users WHERE email = ?",
      [email.toLowerCase()]);
    connection.query(sqlQuery, (err, results) => {
      if (err) {
        console.log(err);
        reject();
      } else {
        const response = results && results.length ? results[0] : {};
        console.log(response);
        resolve(response);
      }
    })
  })
}

/* Takes a plain-text password, encrypts it with a sha256 hash, and returns it */
exports.getHashedPassword = password => {
  const sha256 = crypto.createHash("sha256");
  const hash = sha256.update(password).digest("base64");
  return hash;
}

/* Saves new user with email & password */
exports.saveNewUser = (email, password) => {
  return new Promise((resolve, reject) => {
    const userId = uuid.v1();
    const confirmationCode = uuid.v4();
    const hashedPassword = exports.getHashedPassword(password);
    const sqlQuery = mysql.format("INSERT INTO users (userId, email, password, emailConfirmationCode, emailVerified) VALUES (?, ?, ?, ?, false)",
    [userId, email.toLowerCase(), hashedPassword, confirmationCode]);

    connection.query(sqlQuery, (err, results) => {
      if (err) {
        console.log(err);
        reject();
      } else {
        const mailer = new Mailer();
        mailer.sendConfirmationEmail(email.toLowerCase(), confirmationCode);
        resolve();
      }
    });
  });
}

/* Fetches & scrapes results for a query */
exports.fetchResults = async (query) => {
  // Get query results
  const scraper = new Scraper(query);
  const scrapedData = await scraper.getResults();

  return scrapedData;
}

/* Saves a query's results to the DB */
exports.saveResults = (queryId, resultsList) => {
  return new Promise((resolve, reject) => {
    if (resultsList.length < 1) {
      const sqlQuery = mysql.format("DELETE FROM results WHERE queryId = ?",
        [queryId]);
        connection.query(sqlQuery, (err, results) => {
          if (err) {
            console.log(err);
            reject(err);
          } else {
            resolve();
          }
        });
    }
    // Save each result to results table and replace row if already exists
    const sql = "REPLACE INTO results (queryId, stock, make, model, year, trim, extColor, price, vin, intColor, transmission, engine, miles, dealer, link, carfaxLink, imageLink) VALUES ?";
    const values = resultsList;
    connection.query(sql, [values], function(err) {
      if (err) {
        console.error(err);
        reject(err);
      } else  {
        resolve();
      }
    });
  });
}

/* Helper function to reset a user's emailVerified status */
exports.resetEmailConfirmation = userId => {
  return new Promise((resolve, reject) => {

    const sqlQuery = mysql.format("UPDATE users SET emailVerified = false WHERE userId = ?",
      [userId]);
    connection.query(sqlQuery, (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

/* Parses result data object and saves to new POJO */
exports.parseJson = (data) => {
  const dataObject = {};
  dataObject.name = data["query-name"];
  dataObject.autoUpdates = data["auto-updates"];
  dataObject.onlyNew = data["only-new"];
  dataObject.allDealerships = data["all-dealers"];
  dataObject.model = data["model"];
  dataObject.minPrice = data["min-price"];
  dataObject.maxPrice = data["max-price"];
  dataObject.minYear = data["min-year"];
  dataObject.maxYear = data["max-year"];
  dataObject.customerName = data["customer-name"];
  dataObject.customerPhone = data["customer-phone"];
  dataObject.notes = data["notes"];
  return dataObject;
}

/* Returns boolean indicating if an object follows JSON format or not */
exports.isJson = item => {
  item = typeof item !== "string"
    ? JSON.stringify(item)
    : item;

  try {
    item = JSON.parse(item);
  } catch (e) {
    return false;
  }

  if (typeof item === "object" && item !== null) {
    return true;
  }

  return false;
}