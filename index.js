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

app.post("/api/queries/submit", (req, res) => {
    const isDataJson = isJson(req.body);
    if (isDataJson) {

        const data = parseJson(req.body);
        const sqlQuery = mysql.format("INSERT INTO queries (name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
        [data.name, data.autoUpdates, data.onlyNew, data.allDealerships, data.model, data.minPrice, data.maxPrice, data.minYear, data.maxYear, data.customerName, data.customerPhone, data.notes]);
        // connection.query(sqlQuery, function(err, results) {
        //     if (err) {
        //         console.log(err);
        //     } else {
        //         console.log(results);
        //     }
        // });
        res.status(200).send();
    } else {
        res.status(406).send(); // TODO: is this the right status code?
    }
});

app.get("/api/results/refresh", (req, res) => {
    const sqlQuery = "SELECT * FROM QUERIES";

    // Get all queries from queries table
    connection.query(sqlQuery, async function(err, results) {

        // Iterate for each query
        for (let i = 0; i < results.length; i++) {
            const resultsList = [];

            // Get query results
            const scraper = new Scraper(results[i]);
            const scrapedData = await scraper.getResults();

            // Save array of results into larger array to be passed to SQL query
            for (let k = 0; k < scrapedData.length; k++) {
                let arr = Object.values(scrapedData[k]);
                arr.unshift(results[i].queryId); // Save query id to result row
                resultsList.push(arr);
            }
            
            if (resultsList.length < 1)
                continue;

            // Save each result to results table and replace row if already exists
            const sql = "REPLACE INTO results (queryId, stock, make, model, year, trim, extColor, price, vin, intColor, transmission, engine, miles, dealer, link, carfaxLink) VALUES ?";
            const values = resultsList;
            connection.query(sql, [values], function(err) {
                if (err)
                    console.error(err);
                
            });
        }
    });
});

app.get("/api/results/:queryId", (req, res) => {
    const queryId = req.params.queryId;
    const sqlQuery = `SELECT * FROM results WHERE queryId = ${queryId}`;
    connection.query(sqlQuery, function(err, results) {
        if (err) {
            console.error(err);
        }
        else {
            res.status(200).send(results);
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