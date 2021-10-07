USE dev_db;
DROP TABLE queries;
CREATE TABLE queries (
	id MEDIUMINT AUTO_INCREMENT PRIMARY KEY,
	name VARCHAR(255),
    autoUpdates BOOLEAN,
    onlyNew BOOLEAN,
    allDealerships BOOLEAN,
    model VARCHAR(255),
    minPrice MEDIUMINT,
    maxPrice MEDIUMINT,queriesqueries
    minYear YEAR,
    maxYear YEAR,
    customerName VARCHAR(255),
    customerPhone VARCHAR(255),
    notes VARCHAR(255));
    
