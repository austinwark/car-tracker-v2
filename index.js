const express = require("express");
const mysql = require("mysql");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const session = require("express-session");
const { v1: uuidv1 } = require("uuid");
const Scraper = require("./utils/scraper.js");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(express.static(__dirname + "/public"));

const oneDay = 1000 * 60 * 60 * 24;
app.use(session({
  secret: "2C44-4D44-WppQ38S", // Store in env variable
  resave: true,
  saveUninitialized: false,
  cookie: { maxAge: oneDay }
}));

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "dev_db"
});

connection.connect();

/* Authentication middleware to check session before proceeding to next call */
const authMiddleware = (req, res, next) => {

  if (!req.session || !req.session.email || !req.session.userId) {
    res.redirect("/login");
    return;
  }
    

  getAllUsers().then(users => {

    // Verify session exists and confirm email in session matches with a user in DB before proceeding to next call
    if (users.length > 0 && users.find(user => user.email === req.session.email)) {
      return next();
    } else {
      res.redirect("/login");
    }
  });
}

/* Called by /login and /registration to validate form data before submitting form. */
app.post("/api/users/auth", (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = getHashedPassword(password);

  const sqlQuery = mysql.format("SELECT * FROM USERS WHERE email = ?", [email]);
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
});

/* Called by /login and /registration to get all users to validate form data before submitting form. */
app.get("/api/users/all", (req, res) => {
  const sqlQuery = "SELECT * FROM users";
  connection.query(sqlQuery, (err, results) => {
    res.status(200).send({ results });
  });
});

/* Used to get logged-in user's email from session */
app.get("/api/users/active", (req, res) => {
  if (req.session && req.session.email) {
    res.status(200).send({ email: req.session.email });
  }
});

app.post("/api/users/changePassword", (req, res) => {
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
})

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

/* Called on login form submit. Validates form data one more time. */
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = getHashedPassword(password);

  const sqlQuery = mysql.format("SELECT * FROM users WHERE email = ?", [email]);
  connection.query(sqlQuery, (err, results) => {
    if (err) {
      res.redirect("/login?err=406");
    } else if (results.length == 0) {
      res.redirect("/login?err=404");
    } else {
      const user = results[0];
      if (hashedPassword === user.password) {
        req.session.email = email;
        req.session.userId = user.userId;
        res.redirect("/");
      } else {
        res.redirect("/login?err=401");
      }
    }
  });
});

/* Called on registration form submit. Validates form data one more time. */
app.post("/registration", (req, res) => {
  const { email, password, confirmPassword } = req.body;
    const userId = uuidv1();
    const hashedPassword = getHashedPassword(password);

    const sqlQuery = mysql.format("INSERT INTO users (userId, email, password) VALUES (?, ?, ?)",
    [userId, email, hashedPassword]);
    connection.query(sqlQuery, (err, results) => {
      if (err) {
        res.redirect("/registration?err=406");
      } else {
        res.redirect("/login?newUser=true");
      }
    });
});

const getAllUsers = () => {
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

app.get("/registration", (req, res) => {
  res.sendFile(__dirname + "/registration.html");
});

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

app.get("/", authMiddleware, (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/api/queries/all", authMiddleware, (req, res) => {
    const userId = req.session.userId;

    const sqlQuery = mysql.format('SELECT *, DATE_FORMAT(createdDate, "%m/%e/%Y") AS createdDateFormatted FROM queries WHERE userId = ?', [userId]);
    // Get all queries from queries table
    connection.query(sqlQuery, async function(err, results) {
        if (err) {
            console.log(err);
            return;
        }
        res.status(200).send({ results: results});
        
    })
});

app.get("/api/queries/:queryId", authMiddleware, (req, res) => {
  const userId = req.session.userId;
  const queryId = req.params.queryId;

  const sqlQuery = mysql.format('SELECT *, DATE_FORMAT(createdDate, "%m/%e/%Y") AS createdDateFormatted FROM queries WHERE queryId = ? AND userId = ?', [queryId, userId]);
  connection.query(sqlQuery, function(err, results) {
    if (err) {
      console.error(err);
    } else {
      res.status(200).send(results[0]);
    }
  })
});

app.delete("/api/queries/delete/:queryId", authMiddleware, (req, res) => {
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

app.get("/api/results/refresh/:queryId", authMiddleware, (req, res) => {
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
app.post("/api/queries/submit", authMiddleware, (req, res) => {
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

async function fetchResults(query) {
  // Get query results
  const scraper = new Scraper(query);
  const scrapedData = await scraper.getResults();

  return scrapedData;
}

function saveResults(resultsList) {
  return new Promise((resolve, reject) => {
    if (resultsList.length < 1) {
      resolve();
      return;
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

app.get("/api/results/:queryId", authMiddleware, (req, res) => {
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

const getHashedPassword = password => {
  const sha256 = crypto.createHash("sha256");
  const hash = sha256.update(password).digest("base64");
  return hash;
}
const generateAuthToken = () => {
  return crypto.randomBytes(30).toString('hex');
}

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