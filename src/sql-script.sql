USE dev_db;
-- DROP TABLE IF EXISTS queries;
-- DROP TABLE IF EXISTS queries;
-- ALTER TABLE queries ADD COLUMN userId VARCHAR(255) AFTER queryId;

-- DROPS ALL TABLES IGNORING FOREIGN KEY CHECKS
-- SET FOREIGN_KEY_CHECKS = 0;
-- DROP TABLE IF EXISTS queries;
-- DROP TABLE IF EXISTS results;
-- DROP TABLE IF EXISTS users;
-- SET FOREIGN_KEY_CHECKS = 1;


CREATE TABLE IF NOT EXISTS users (
	userId VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);
CREATE TABLE IF NOT EXISTS queries (
	queryId MEDIUMINT AUTO_INCREMENT,
    userId VARCHAR(255) NOT NULL,
	name VARCHAR(255) NOT NULL,
    autoUpdates BOOLEAN NOT NULL,
    onlyNew BOOLEAN NOT NULL,
    allDealerships BOOLEAN NOT NULL,
    model VARCHAR(255) NOT NULL,
    minPrice MEDIUMINT NOT NULL,
    maxPrice MEDIUMINT NOT NULL,
    minYear YEAR NOT NULL,
    maxYear YEAR NOT NULL,
    customerName VARCHAR(255),
    customerPhone VARCHAR(255),
    notes VARCHAR(255),
    numberOfResults MEDIUMINT DEFAULT 0,
    createdDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (queryId, userId),
    CONSTRAINT FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE ON UPDATE CASCADE
    );
CREATE TABLE IF NOT EXISTS results (
    queryId MEDIUMINT NOT NULL,
    stock VARCHAR(255) NOT NULL,
    make VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    year MEDIUMINT NOT NULL,
    trim VARCHAR(255),
    extColor VARCHAR(255),
    price MEDIUMINT NOT NULL,
    vin VARCHAR(255) NOT NULL,
    intColor VARCHAR(255),
    transmission VARCHAR(255),
    engine VARCHAR(255),
    miles VARCHAR(255),
    dealer VARCHAR(255),
    link VARCHAR(255),
    carfaxLink VARCHAR(255),
    imageLink VARCHAR(255),
    PRIMARY KEY (queryId, vin),
    CONSTRAINT foreignKeyQuery FOREIGN KEY (queryId) REFERENCES queries(queryId) ON DELETE CASCADE ON UPDATE CASCADE
);
SELECT * FROM queries;
    
-- INSERT INTO queries (name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes) VALUES ('test query', true, false, true, 'Corolla', 20000, 25000, 2002, 2019, 'Austin', '5555555555', 'test notes');
-- SELECT * FROM queries;
-- SHOW TABLES;
-- DESCRIBE queries;
-- SELECT * FROM queries;
-- SELECT * FROM results;
-- INSERT INTO queries (name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes) VALUES ('test query', true, false, true, 'Corolla', 20000, 25000, 2002, 2019, 'Austin', '5555555555', 'test notes');
-- SELECT * FROM queries WHERE queryId = (SELECT LAST_INSERT_ID());


-- ALTER TABLE queries ADD COLUMN createdDate DATETIME DEFAULT CURRENT_TIMESTAMP; 
-- SELECT *, DATE_FORMAT(createdDate, "%m/%e/%Y") AS createdDateFormatted FROM queries;
-- SELECT * FROM results;
SELECT * FROM users;
