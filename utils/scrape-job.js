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
    const { queryId, autoUpdates, onlyNew } = query;

    fetchResults(query).then(resultsList => {
      query.numberOfResults = resultsList.length;
      // console.log(resultsList)
      const sqlQuery = mysql.format("REPLACE INTO queries (queryId, userId, name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes, numberOfResults, createdDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [...Object.values(query)]);
        
          connection.query(sqlQuery, err => {
            if (err) console.log(err);
            
            setScrapedResultsViewed(queryId, resultsList).then(updatedResults => {
              
              if (updatedResults.length > 0 && autoUpdates && emailVerified) {
                
                const mailer = new Mailer(onlyNew);
                mailer.sendResultsEmail(email, query, updatedResults).then(() => {
                  saveResults(queryId, true, updatedResults);
                }).catch(err => {
                  saveResults(queryId, false, updatedResults);
                });
              }
            });
          });
    });
  }
}

const setScrapedResultsViewed = (queryId, scrapedResults) => {
  return new Promise((resolve, reject) => {

    const sqlQuery = mysql.format("SELECT * FROM results WHERE queryId = ?",
      [queryId]);
    connection.query(sqlQuery, (err, currentResults) => {
      if (err) {
        reject(err);
        return;
      }

      
      for (let scrapedResult of scrapedResults) {
        let isNewResult = true;
        for (let currentResult of currentResults) {

          if (currentResult.vin === scrapedResult.vin) {
            isNewResult = currentResult.isNewResult;
          }
        }
        scrapedResult.isNewResult = isNewResult;
      }
      resolve(scrapedResults);
      return;
    });
  });
}

const saveResults = (queryId, setResultsViewed, resultsObj) => {
  if (setResultsViewed) {
    for (let result of resultsObj)
      result.isNewResult = false;
  }
  let resultsList = resultsObj.map(result => {
    const arr = Object.values(result);
    if (!result.hasOwnProperty("queryId"))
      arr.unshift(queryId);
    return arr;
  });
  return new Promise((resolve, reject) => {
    if (resultsList.length < 1) {
      const sqlQuery = mysql.format("DELETE FROM results WHERE queryId = ?",
        [queryId]);
        connection.query(sqlQuery, (err, results) => {
          if (err) {
            console.log(err);
            reject(err);
            return;
          } else {
            resolve();
            return;
          }
        });
    }
    
    const sqlQuery = mysql.format("REPLACE INTO results (queryId, stock, make, model, year, trim, extColor, price, vin, intColor, transmission, engine, miles, dealer, link, carfaxLink, imageLink, isNewResult) VALUES ?",
      [resultsList]);
    connection.query(sqlQuery, (err, results) => {
      if (err) {
        console.log(err);
        reject(err);
        return;
      } else {
        resolve();
        return;
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