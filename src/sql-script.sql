USE dev_db;
-- DROP TABLE IF EXISTS queries;

-- CREATE TABLE IF NOT EXISTS queries (
-- 	queryId MEDIUMINT AUTO_INCREMENT PRIMARY KEY,
-- 	name VARCHAR(255) NOT NULL,
--     autoUpdates BOOLEAN NOT NULL,
--     onlyNew BOOLEAN NOT NULL,
--     allDealerships BOOLEAN NOT NULL,
--     model VARCHAR(255) NOT NULL,
--     minPrice MEDIUMINT NOT NULL,
--     maxPrice MEDIUMINT NOT NULL,
--     minYear YEAR NOT NULL,
--     maxYear YEAR NOT NULL,
--     customerName VARCHAR(255),
--     customerPhone VARCHAR(255),
--     notes VARCHAR(255));

-- DROP TABLE IF EXISTS results;
-- CREATE TABLE IF NOT EXISTS results (
--     queryId MEDIUMINT NOT NULL,
--     stock VARCHAR(255) NOT NULL,
--     make VARCHAR(255) NOT NULL,
--     model VARCHAR(255) NOT NULL,
--     year MEDIUMINT NOT NULL,
--     trim VARCHAR(255),
--     extColor VARCHAR(255),
--     price MEDIUMINT NOT NULL,
--     vin VARCHAR(255) NOT NULL,
--     intColor VARCHAR(255),
--     transmission VARCHAR(255),
--     engine VARCHAR(255),
--     miles VARCHAR(255),
--     dealer VARCHAR(255),
--     link VARCHAR(255),
--     carfaxLink VARCHAR(255),
--     PRIMARY KEY (queryId, vin),
--     CONSTRAINT foreignKeyQuery FOREIGN KEY (queryId) REFERENCES queries(queryId) ON DELETE CASCADE ON UPDATE CASCADE
-- );
    
-- INSERT INTO queries (name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes) VALUES ('test query', true, false, true, 'Corolla', 20000, 25000, 2002, 2019, 'Austin', '5555555555', 'test notes');
-- SELECT * FROM queries;
-- SHOW TABLES;
-- DESCRIBE queries;
-- SELECT * FROM queries;
-- SELECT * FROM results;
-- INSERT INTO queries (name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes) VALUES ('test query', true, false, true, 'Corolla', 20000, 25000, 2002, 2019, 'Austin', '5555555555', 'test notes');
-- SELECT * FROM queries WHERE queryId = (SELECT LAST_INSERT_ID());

-- SELECT * FROM queries;

DELETE FROM queries WHERE 1 = 1;
SELECT * FROM queries;
SELECT * FROM results;
