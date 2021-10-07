const express = require("express");
const mysql = require("mysql");

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
    connection.query(sqlQuery, function(err, results) {
        if (err) {

            console.log(err);
        } else {
            // console.log(results);
            res.status(200).send({ results: results});
        }
    })
});

app.post("/api/queries/submit", (req, res) => {
    const isDataJson = isJson(req.body);
    if (isDataJson) {

        console.log(req.body);
        const data = parseJson(req.body);
        console.log(data);
        const sqlQuery = mysql.format("INSERT INTO queries (name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
        [data.name, data.autoUpdates, data.onlyNew, data.allDealerships, data.model, data.minPrice, data.maxPrice, data.minYear, data.maxYear, data.customerName, data.customerPhone, data.notes]);
        console.log(sqlQuery);
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