require("dotenv").config();
const mysql = require("mysql");
const fs = require("fs");
const Scraper = require("./scraper.js");
const Mailer = require("./mailer.js");

"use strict";

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: true
});
connection.connect();

/* First function called, gets all users from DB and passes to getAllQueries */
const getAllUsers = () => {
  const sqlQuery = "SELECT * FROM users";
  connection.query(sqlQuery, (err, results) => {
    if (err) {
      console.log(err);
    } else {
      
      getAllQueries(results);
    }
  });
}

/* Gets all queries from DB and calls scrapeAndProcessResults for each user */
const getAllQueries = users => {

  const sqlQuery = "SELECT * FROM queries";
  connection.query(sqlQuery, (err, results) => {
    if (err) console.log(err);

    /* For each user, pass user and the user's queries to scrapeAndProcessResults */
    for (let user of users) {
      const { userId } = user;
      // Filter for the user's queries only
      const userQueries = results.filter(result => result.userId === userId);
      scrapeAndProcessResults(user, userQueries);
    }
  });
}

/* Called for each user, scrapes new data for each query, logs, and emails the results */
const scrapeAndProcessResults = async (user, queries) => {
  const { email, emailVerified } = user;

  // Keeps track of total stats. Used to send email log */
  let totalNumberOfEmailsSent = 0;
  let totalNumberOfResultsSent = 0;

  // For each of the user's queries
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const { queryId, autoUpdates, onlyNew } = query;

    // Fetch scraped results
    const resultsList = await fetchResults(query);
    query.numberOfResults = resultsList.length;
    
    // Update query's numberOfResults in DB
    const sqlQuery = mysql.format("REPLACE INTO queries (queryId, userId, name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes, numberOfResults, createdDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [...Object.values(query)]);
    connection.query(sqlQuery, async err => {
      if (err) console.log(err);

      // Update the results' isNewResult fields in DB
      let updatedResults = await setScrapedResultsViewed(queryId, resultsList);

      // Only email results if autoUpdates is enabled and email is verified
      if (updatedResults.length > 0 && autoUpdates && emailVerified) {

        // Pass results to Mailer to be filtered and sent to user. Returns number of results and emails sent
        const { numberOfResultsSent, numberOfEmailsSent } = await sendAndSaveResults(email, query, updatedResults);
        totalNumberOfEmailsSent += numberOfEmailsSent;
        totalNumberOfResultsSent += numberOfResultsSent;
      }

      // When on last iteration, send logs to admin
      if (i == queries.length - 1) {
        const path = __dirname + "/job-log.json";
        sendLogsToEmail(path, totalNumberOfEmailsSent, totalNumberOfResultsSent);
      }
    })
  }
}

/* Uses a Mailer instance to send job logs to admin's email */
const sendLogsToEmail = async (path, numberOfEmailsSent, numberOfResultsSent) => {
  const mailer = new Mailer();
  mailer.sendLogsEmail(path, numberOfEmailsSent, numberOfResultsSent);
}

/* Sends results to user's email and saves results to DB */
const sendAndSaveResults = async (email, query, results) => {
  // Keeps track of stats to send to admin 
  let numberOfEmailsSent = 0;
  let numberOfResultsSent = 0;

  return new Promise(async (resolve, reject) => {
    try {
      // Send results to user's email, returns number of results sent after filtering for onlyNew results (if setting is on)
      const mailer = new Mailer(query.onlyNew);
      numberOfResultsSent = await mailer.sendResultsEmail(email, query, results);

      // Save results to DB. The email went through so setResultsViewed = true
      saveResults(query.queryId, true, results);
    } catch (err) {
      console.log(err);

      // Save results to DB. The email did not go through so setResultsViewed = false
      saveResults(query.queryId, false, results);
    }
    // Log the data if results were sent to user
    if (numberOfResultsSent > 0) {
      numberOfEmailsSent++;
      await logJobData(email, query, results);
    }
    resolve({ numberOfEmailsSent, numberOfResultsSent });
  })
}


/* Checks scraped results against results in DB to persist isResultNew value */
const setScrapedResultsViewed = (queryId, scrapedResults) => {
  return new Promise((resolve, reject) => {

    // Get all current results in DB
    const sqlQuery = mysql.format("SELECT * FROM results WHERE queryId = ?",
      [queryId]);
    connection.query(sqlQuery, (err, currentResults) => {
      if (err) {
        reject(err);
        return;
      }
      
      // For each newly scraped result
      for (let scrapedResult of scrapedResults) {
        let isNewResult = true;
        // For each current result in DB
        for (let currentResult of currentResults) {

          // If scraped result exists already in DB, persist its isNewResult value
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

/* Saves results to DB. */ 
const saveResults = (queryId, setResultsViewed, resultsObj) => {

  /* If setResultsViewed = true, each result's isNewResult field is set to false */
  if (setResultsViewed) {
    for (let result of resultsObj)
      result.isNewResult = false;
  }
  // Convert array of objects to array of arrays, to be saved to DB
  let resultsList = resultsObj.map(result => {
    const arr = Object.values(result);
    if (!result.hasOwnProperty("queryId"))
      arr.unshift(queryId);
    return arr;
  });

  return new Promise((resolve, reject) => {

    // Delete the query's current results in DB
    deleteQueryResults(queryId).then(() => {

      // If there is no newly scraped results, return. Nothing else to do 
      if (resultsList.length < 1) {
        resolve();
        return;
      }

      // If there are newly scraped results, save them to DB
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
      });
    }).catch(err => {
      reject(err);
    });
  });
}

/* Helper function to delete a query's results in DB */
const deleteQueryResults = queryId => {

  return new Promise((resolve, reject) => {
    const sqlQuery = mysql.format("DELETE FROM results WHERE queryId = ?",
      [queryId]);
    connection.query(sqlQuery, err => {
      if (err) {
        console.log(err);
        reject(err);
        return;
      }

      resolve();
    });
  });
}

/* Helper function to get a query's newly scraped results from scraper.js */
async function fetchResults(query) {

  const scraper = new Scraper(query);
  const scrapedData = await scraper.getResults();

  return scrapedData;
}

/* Logs data for every email sent by this scheduled job */
function logJobData(email, query, results) {

  return new Promise((resolve, reject) => {

    const path = __dirname + "/job-log.json";
    const date = new Date();
    const isoDateTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
    
    const dataObj = {
      timeStamp: isoDateTime,
      email,
      query,
      results
    }
    const baseObj = {
      logData: []
    }
  
    // This will overwrite the file contents with baseObj (empty array)
    // fs.writeFileSync(path, JSON.stringify(baseObj));
  
    // Get current file contents
    getFileContents(path).then(contents => {
      
      // If file is not empty (contents !== null)
      if (contents) {
  
        // Push data to array in file and save the result
        contents.logData.unshift(dataObj);
        fs.writeFileSync(path, JSON.stringify(contents));
        resolve(path);
      } else {
  
        // If file is empty -- write the base object with data to file
        baseObj.logData.push(dataObj);
        fs.writeFileSync(path, JSON.stringify(baseObj));
        resolve(path);
      }
    });
  })
}

/* Helper function to get contents of file */
const getFileContents = async path => {
  const data = fs.readFileSync(path, "utf-8");
  let contents;
  if (data && data.length > 0)
    contents = JSON.parse(data);
  else
    contents = null;
  return contents;
}

getAllUsers();