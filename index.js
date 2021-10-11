const express = require("express");
const mysql = require("mysql");
const Scraper = require("./utils/scraper.js");

const app = express();
app.use(express.json());
app.use(express.static(__dirname + "/public"));

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "dev_db"
});

connection.connect();

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.get("/api/queries/all", (req, res) => {
    const sqlQuery = 'SELECT *, DATE_FORMAT(createdDate, "%m/%e/%Y") AS createdDateFormatted FROM queries';
    // Get all queries from queries table
    connection.query(sqlQuery, async function(err, results) {
        if (err) {
            console.log(err);
            return;
        }
        res.status(200).send({ results: results});
        
    })
});

app.get("/api/queries/:queryId", (req, res) => {
  const queryId = req.params.queryId;
  const sqlQuery = mysql.format('SELECT *, DATE_FORMAT(createdDate, "%m/%e/%Y") AS createdDateFormatted FROM queries WHERE queryId = ?', [queryId]);
  connection.query(sqlQuery, function(err, results) {
    if (err) {
      console.error(err);
    } else {
      res.status(200).send(results[0]);
    }
  })
});

app.delete("/api/queries/delete/:queryId", (req, res) => {
  const queryId = req.params.queryId;
  const sqlQuery = mysql.format("DELETE FROM queries WHERE queryId = ?", [queryId]);
  connection.query(sqlQuery, function(err, results) {
    if (err) {
      res.status(406).send();
    } else {
      res.status(200).send();
    }
  })
});

app.get("/api/results/refresh/:queryId", (req, res) => {
  try {
    const queryId = req.params.queryId;
    const sqlQuery = mysql.format('SELECT *, DATE_FORMAT(createdDate, "%m/%e/%Y") AS createdDateFormatted FROM queries WHERE queryId = ?', [queryId]);
    // 1) Fetch query by queryId from DB
    connection.query(sqlQuery, (err, results) => {
      
        const data = results[0];
        // 2) Scrape results first to save numberOfResults to query data row
        fetchResults(data).then(resultsList => {
          const numberOfResults = resultsList.length;
          const sqlQuery = mysql.format("REPLACE INTO queries (queryId, name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes, numberOfResults) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
          [queryId, data.name, data.autoUpdates, data.onlyNew, data.allDealerships, data.model, data.minPrice, data.maxPrice, data.minYear, data.maxYear, data.customerName, data.customerPhone, data.notes, numberOfResults]);
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
            saveResults(updatedResultsList).then(() => {
              res.status(200).send({ queryId });
            });
          });
        });
    });
  } catch (error) {
    console.log(error);
    res.status(406).send(error);
  }
})

// TODO: MAKE SURE NUMBEROFRESULTS ARE SAVED EACH TIME RESULTS ARE SCRAPED
app.post("/api/queries/submit", (req, res) => {
  // 1) Validate form data
  const isDataJson = isJson(req.body);
  if (!isDataJson)
    return;

  const data = parseJson(req.body);

  try {
    // 2) Scrape results first to save numberOfResults to query data row
    fetchResults(data).then(resultsList => {
  
      const numberOfResults = resultsList.length;
      const sqlQuery = mysql.format("INSERT INTO queries (name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes, numberOfResults) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
      [data.name, data.autoUpdates, data.onlyNew, data.allDealerships, data.model, data.minPrice, data.maxPrice, data.minYear, data.maxYear, data.customerName, data.customerPhone, data.notes, numberOfResults]);
      // 3) Save query to DB
      connection.query(sqlQuery, (error, results) => {
  
        const queryId = results.insertId;
        const updatedResultsList = [];
  
        // 4) Add queryId to each results data
        for (let k = 0; k < resultsList.length; k++) {
          let arr = Object.values(resultsList[k]);
          arr.unshift(queryId); // Save query id to result row
          updatedResultsList.push(arr);
        }
        
        // 5) Save results to DB and then send OK response back to front-end
        saveResults(updatedResultsList).then(() => {
          res.status(200).send({ queryId });
        });
  
      });
    });
  } catch (error) {
    console.log(error);
    res.status(406).send(error);
  }
});

function fetchAndSaveResultsAndQuery(query) {}

async function fetchResults(query) {
  // Get query results
  const scraper = new Scraper(query);
  const scrapedData = await scraper.getResults();

  return scrapedData;
}

function saveResults(resultsList) {



  return new Promise((resolve, reject) => {
    console.log(resultsList.length)
    if (resultsList.length < 1) {
      resolve();
      return;
    }
    // Save each result to results table and replace row if already exists
    const sql = "REPLACE INTO results (queryId, stock, make, model, year, trim, extColor, price, vin, intColor, transmission, engine, miles, dealer, link, carfaxLink) VALUES ?";
    const values = resultsList;
    connection.query(sql, [values], function(err) {
      if (err) {
        console.error(err);
        reject(err);
      } else  {
        console.log("RESOLVE")
        resolve();
      }
    });
  });
}

app.get("/api/results/:queryId", (req, res) => {
    const queryId = req.params.queryId;
    const sqlQuery = `SELECT * FROM results WHERE queryId = ${queryId}`;
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
    })
})

function parseJson(data) {
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

/* Helper method to check if String is in JSON format. Returns boolean value */
function isJson(item) {
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

app.listen(3000, () => console.log("Express server started at port 3000."));