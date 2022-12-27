require("dotenv").config();
const mysql = require("mysql");
const session = require("express-session");
const Mailer = require("../utils/mailer.js");

const { getAllUsers, getHashedPassword, saveNewUser, fetchResults, 
  saveResults, resetEmailConfirmation, parseJson, isJson } = require("../utils/serverHelperFunctions");

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: true
});

connection.connect();

exports.getAllQueries = (req, res) => {
  const userId = req.session.userId;
  const sqlQuery = mysql.format('SELECT *, DATE_FORMAT(createdDate, "%m/%e/%Y") AS createdDateFormatted FROM queries WHERE userId = ?', [userId]);
  // Get all queries from queries table
  connection.query(sqlQuery, async function(err, results) {
      if (err) {
          console.log(err);
          return;
      }
      res.status(200).send({ results: results}); 
  });
}

exports.getSingleQuery = (req, res) => {
  const userId = req.session.userId;
  const queryId = req.params.queryId;

  const sqlQuery = mysql.format('SELECT *, DATE_FORMAT(createdDate, "%m/%e/%Y") AS createdDateFormatted FROM queries WHERE queryId = ? AND userId = ?', [queryId, userId]);
  connection.query(sqlQuery, function(err, results) {
    if (err) {
      console.error(err);
    } else {
      res.status(200).send(results[0]);
    }
  });
}

exports.deleteSingleQuery = (req, res) => {
  const queryId = req.params.queryId;
  const sqlQuery = mysql.format("DELETE FROM queries WHERE queryId = ?", [queryId]);
  connection.query(sqlQuery, function(err, results) {
    if (err) {
      res.status(406).send();
    } else {
      res.status(200).send();
    }
  });
}

exports.refreshResults = (req, res) => {
  try {
    const userId = req.session.userId;
    const queryId = req.params.queryId;

    const sqlQuery = mysql.format('SELECT *, DATE_FORMAT(createdDate, "%m/%e/%Y") AS createdDateFormatted FROM queries WHERE queryId = ? AND userId = ?', [queryId, userId]);
    // 1) Fetch query by queryId from DB
    connection.query(sqlQuery, (err, results) => {
      
        const data = results[0];
        // 2) Scrape results first to save numberOfResults to query data row
        fetchResults(data).then(resultsList => {
          const numberOfResults = resultsList.length;
          const sqlQuery = mysql.format("REPLACE INTO queries (queryId, userId, name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes, numberOfResults) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
          [queryId, userId, data.name, data.autoUpdates, data.onlyNew, data.allDealerships, data.model, data.minPrice, data.maxPrice, data.minYear, data.maxYear, data.customerName, data.customerPhone, data.notes, numberOfResults]);
          // 3) Save query to DB
          connection.query(sqlQuery, (error, results) => {
            const queryId = results.insertId;

            // 4) Add queryId to each results data
            const updatedResultsList = resultsList.map(item => {
              let arr = Object.values(item);
              arr.unshift(queryId);
              return arr;
            });
            
            // 5) Save results to DB and then send OK response back to front-end
            saveResults(queryId, updatedResultsList).then(() => {
              res.status(200).send({ queryId });
            }).catch(err => res.status(400).send());
          });
        });
    });
  } catch (error) {
    console.log(error);
    res.status(406).send(error);
  }
}

exports.saveNewQuery = (req, res) => {
  // 1) Validate form data
  const isDataJson = isJson(req.body);
  if (!isDataJson) {
    res.status(406).send();
    return;
  }

  const userId = req.session.userId;
  const data = parseJson(req.body);
  try {
    // 2) Scrape results first to save numberOfResults to query data row
    fetchResults(data).then(resultsList => {
  
      const numberOfResults = resultsList.length;
      const sqlQuery = mysql.format("INSERT INTO queries (userId, name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes, numberOfResults) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
      [userId, data.name, data.autoUpdates, data.onlyNew, data.allDealerships, data.model, data.minPrice, data.maxPrice, data.minYear, data.maxYear, data.customerName, data.customerPhone, data.notes, numberOfResults]);
      // 3) Save query to DB
      connection.query(sqlQuery, (error, results) => {
        if (error) {
          console.log(error);
          return;
        }
        const queryId = results.insertId;
        const updatedResultsList = [];
  
        // 4) Add queryId to each results data
        for (let k = 0; k < resultsList.length; k++) {
          let arr = Object.values(resultsList[k]);
          arr.unshift(queryId); // Save query id to result row
          updatedResultsList.push(arr);
        }
        
        // 5) Save results to DB and then send OK response back to front-end
        saveResults(queryId, updatedResultsList).then(() => {
          res.status(200).send({ queryId });
        }).catch(err => res.status(400).send());
  
      });
    });
  } catch (error) {
    console.log(error);
    res.status(406).send(error);
  }
}

exports.getSortedResults = (req, res) => {
  const queryId = req.params.queryId;
  const sortBy = req.params.sortBy.toLowerCase();
  const sortOrder = req.params.sortOrder.toUpperCase();

  const sqlQuery = `SELECT * FROM results WHERE queryId = ${queryId} ORDER BY ${sortBy} ${sortOrder}`;
  connection.query(sqlQuery, function(err, results) {
      if (err) {
          console.error(err);
      }
      else {
          const responseData = {
              results,
              queryId
          }
          res.status(200).send(responseData);
      }
  });
}

exports.emailResults = async (req, res) => {
  
  const { results } = req.body;
  const { queryId } = results[0];
  const email = req.session.email;

  // Get all users
  const allUsers = await getAllUsers();
  // Find the signed in user for the emailConfirmationCode
  const user = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    res.status(401).send();
    return;
  }
  
  const sqlQuery = mysql.format("SELECT * FROM queries WHERE queryId = ?",
    [queryId]);
  connection.query(sqlQuery, (err, queryResults) => {
    if (err) {
      console.log(err);
      res.status(400).send(err);
      return;
    }

    const query = queryResults[0];
    const mailer = new Mailer();
    mailer.sendResultsEmail(email, query, results, user.emailConfirmationCode);
    res.status(200).send();
  });
}

