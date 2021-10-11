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
    const sqlQuery = "SELECT * FROM queries";
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
  const sqlQuery = mysql.format("SELECT * FROM queries WHERE queryId = ?", [queryId]);
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
})

// TODO: Restructure so the function operates in this order:
// 1. Fetch and save results to db
// 2. Save query to db
// 3. Returns
app.post("/api/queries/submit", (req, res) => {

    // Validate form data
    const isDataJson = isJson(req.body);
    if (isDataJson) {

        const data = parseJson(req.body);
        const sqlQuery = mysql.format("INSERT INTO queries (name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
        [data.name, data.autoUpdates, data.onlyNew, data.allDealerships, data.model, data.minPrice, data.maxPrice, data.minYear, data.maxYear, data.customerName, data.customerPhone, data.notes]);
        // Save query to DB
        connection.query(sqlQuery, function(err, results) {
        if (err) {
            console.log(err);
            res.status(400).send();
        } else {
            // Get query back from DB (with its assigned queryId)
            const sqlQuery2 = "SELECT * FROM queries WHERE queryId = (SELECT LAST_INSERT_ID())";
            connection.query(sqlQuery2, function(err, results) {
              if (err) {
                console.log(err);
              } else {
                const { queryId } = results[0];

                // Scrape and save query results to DB. Waits until this is done before sending "done" status to browser
                try {

                  fetchAndSaveResultsPromise(results[0]).then(numberOfResults => {
                    updateQueryWithNumberOfResults(queryId, numberOfResults).then(() => {
                      res.status(200).send({ queryId });
                    });
                  });
                } catch (err) {
                  console.log(err);
                  res.status(406).send(err);
                }
              }
            });
        }
        });
    } else {
        res.status(406).send(); // TODO: is this the right status code?
    }
});

function updateQueryWithNumberOfResults(queryId, numberOfResults) {
  const sqlQuery = mysql.format("UPDATE queries SET numberOfResults = ? WHERE queryId = ?", [numberOfResults, queryId]);
  return new Promise((resolve, reject) => {
    connection.query(sqlQuery, function(err) {
      if (err) {
        console.error(err);
        reject(err);
      } else  {
        console.log("RESOLVE 2")
        resolve();
      }
    });
  });
}

async function fetchAndSaveResultsPromise(query) {
  const resultsList = [];
  // Get query results
  const scraper = new Scraper(query);
  const scrapedData = await scraper.getResults();

  // Save array of results into larger array to be passed to SQL query
  for (let k = 0; k < scrapedData.length; k++) {
      let arr = Object.values(scrapedData[k]);
      arr.unshift(query.queryId); // Save query id to result row
      resultsList.push(arr);
  }
  if (resultsList.length < 1)
      return;

  // Save each result to results table and replace row if already exists
  const sql = "REPLACE INTO results (queryId, stock, make, model, year, trim, extColor, price, vin, intColor, transmission, engine, miles, dealer, link, carfaxLink) VALUES ?";
  const values = resultsList;
  const numberOfResults = values.length;

  return new Promise((resolve, reject) => {
    connection.query(sql, [values], function(err) {
      if (err) {
        console.error(err);
        reject(err);
      } else  {
        console.log("RESOLVE")
        resolve(numberOfResults);
      }
    });
  });
}

async function fetchAndSaveResults(query) {
  const resultsList = [];
  // Get query results
  const scraper = new Scraper(query);
  const scrapedData = await scraper.getResults();

  // Save array of results into larger array to be passed to SQL query
  for (let k = 0; k < scrapedData.length; k++) {
      let arr = Object.values(scrapedData[k]);
      arr.unshift(query.queryId); // Save query id to result row
      resultsList.push(arr);
  }
  if (resultsList.length < 1)
      return;

  // Save each result to results table and replace row if already exists
  const sql = "REPLACE INTO results (queryId, stock, make, model, year, trim, extColor, price, vin, intColor, transmission, engine, miles, dealer, link, carfaxLink) VALUES ?";
  const values = resultsList;
  connection.query(sql, [values], function(err) {
      if (err)
          console.error(err);
      
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