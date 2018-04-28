import { Pool } from "promise-mysql";

export class Queries {

  public CreateTableIfNotExists(aggregate: string) {
    const sql = `CREATE TABLE IF NOT EXISTS ${aggregate}(`
    + 'id INT NOT NULL AUTO_INCREMENT,'
    + 'eventId VARCHAR(36) NOT NULL'
    + 'aggregateType VARCHAR(255)'
    + 'aggregateId VARCHAR(36) NOT NULL'
    + 'aggregateVersion INT'
    + 'eventType VARCHAR(255)'  
    + 'eventData LONGTEXT'
    + 'eventMetadata TEXT'
    + 'transactionTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    + 'PRIMARY KEY(id, aggregateId),'    
    +  ')';
    
    return sql;
  }

  public CreateDatabaseIfNotExists(dbName: string) {
    const sql = `CREATE DATABASE IF NOT EXISTS ${dbName}`;
    return sql;
  }

  public selectAllEventsOfStream(aggregate: string) {
    const sql = 'SELECT * FROM `' + aggregate + '` WHERE `streamId` = ? ORDER BY `aggregateVersion` DESC';
    return sql;
  }

  public insertIntoAggregateTable(aggregate: string) {
    const sql = 'INSERT INTO `' + aggregate + 'SET ?';
    return sql;
  }
}

