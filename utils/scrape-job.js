require("dotenv").config();
const mysql = require("mysql");
const nodemailer = require("nodemailer");
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

const getAllUsers = () => {
  const sqlQuery = "SELECT * FROM users";
  connection.query(sqlQuery, (err, results) => {
    if (err) {
      console.log(err);
    } else {
      
      getAllQueries(results);
    }
  })
}

const getAllQueries = users => {

  const dataObj = {}; // => { userId: [ {result}, {result}, {result} ], userId: [ {result} ] }
  const sqlQuery = "SELECT * FROM queries";
  connection.query(sqlQuery, (err, results) => {
    if (err) console.log(err);

    for (let user of users) {
      const { userId } = user;
      dataObj[userId] = results.filter(result => result.userId === userId);
      const userQueries = results.filter(result => result.userId === userId);
      scrapeResults(user, userQueries);
    }
  });
}

const scrapeResults = (user, queries) => {
  const { email, emailVerified } = user;

  for (let query of queries) {
    const { queryId, autoUpdates } = query;

    fetchResults(query).then(resultsList => {
      query.numberOfResults = resultsList.length;

      const sqlQuery = mysql.format("REPLACE INTO queries (queryId, userId, name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes, numberOfResults, createdDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [...Object.values(query)]);
        
          connection.query(sqlQuery, err => {
            if (err) console.log(err);
            const updatedResultsList = resultsList.map(result => {
              const arr = Object.values(result);
              if (!result.hasOwnProperty("queryId"))
                arr.unshift(queryId);
              return arr;
            });

            saveResults(queryId, updatedResultsList);
            if (autoUpdates && emailVerified) {
              const mailer = new Mailer();
              mailer.sendResultsEmail(email, query, resultsList);
            }
          });
    });
  }
}

const saveResults = (queryId, resultsList) => {
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

    const sqlQuery = mysql.format("REPLACE INTO results (queryId, stock, make, model, year, trim, extColor, price, vin, intColor, transmission, engine, miles, dealer, link, carfaxLink, imageLink) VALUES ?",
      [resultsList]);
    connection.query(sqlQuery, (err, results) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        resolve();
      }
    })
  })
}

async function fetchResults(query) {

  const scraper = new Scraper(query);
  const scrapedData = await scraper.getResults();

  return scrapedData;
}

getAllUsers();