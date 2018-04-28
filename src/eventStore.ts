import { createPool, Pool, Connection, createConnection, Query, RowDataPacket } from "mysql2/promise";
import { Type, serialize, Guid, requireByFQN, deserialize } from "@cashfarm/lang";
import { EventEnvelope, GuidIdentity } from "@cashfarm/plow";

import { Queries } from './queries';
import { EsConnectionConfig } from "./interfaces/esConnectionConfig";

const debug = require('debug')('eventstore')


export class EventStore {

  private connectionPool: Pool;
  private queries: Queries;

  constructor(esConnectionConfig: EsConnectionConfig) {
    this.queries = new Queries();

    this.connectToDatabase(esConnectionConfig);
  }


  public listEventsStream(streamId: string, aggregate: string): EventEnvelope[] {
    debug('Getting events stream');

    const events: EventEnvelope[] = [];

    this.connectionPool.execute(this.queries.selectAllEventsOfStream(aggregate), [streamId])
      .then(([results, fields]) => {
        const rows = <RowDataPacket[]>results;

        rows.map(row => {
          events.push(this.getEventEnvelope(row));
        })

      }).catch(error => {
        debug('Error getting events stream, check logs: ', error);
        throw error;
      })

    return events;
  }

  public async saveEvents(events: EventEnvelope[]) {
    debug('Saving Events');

    const connection = await this.connectionPool.getConnection();
    const queryArray = this.getQueryArray(connection, events);

    connection.beginTransaction().then(transaction => {
      queryArray.reduce((a, b) => {
        return a.then(b)
      }, <any>Promise.resolve());
    })
  }

  private getQueryArray(connection: Connection, events: EventEnvelope[]) {
    const queryArray = events.map(event => {
      const serializedEvent = {
        eventId: new Guid(),
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId.toString(),
        aggregateVersion: event.aggregateVersion,
        eventType: event.eventType,
        eventData: serialize(event.event),
        eventMetadata: event.metadata.toString(),
        transactionTime: new Date()
      };

      return connection.execute(this.queries.insertIntoAggregateTable(event.aggregateType), serializedEvent).catch(error => {
        return connection.rollback().then(() => {
          debug('Error saving event, check logs: ', error);
          throw error;
        })
      })
    });

    return queryArray;
  }

  private getEventEnvelope(event: RowDataPacket) {
    const eventClass = requireByFQN(event.eventType);
    let metadata;

    try {
      metadata = JSON.parse(event.eventMetadata);
    } catch (error) {
      console.log(error);
    }

    const eventEnvelope = new EventEnvelope(
      event.eventId,
      event.aggregateType,
      new GuidIdentity(event.aggregateId),
      event.aggregateVersion,
      event.eventType,
      deserialize(eventClass, event.eventData),
      metadata,
      new Date(event.transactionTime)
    );

    return eventEnvelope;
  }

  private connectToDatabase(esConnectionConfig: EsConnectionConfig) {
    debug('Connecting to database');

    this.connectionPool = createPool({
      connectionLimit: esConnectionConfig.poolConfig.connectionLimit,
      host: esConnectionConfig.poolConfig.host,
      port: esConnectionConfig.poolConfig.port,
      user: esConnectionConfig.poolConfig.user,
      password: esConnectionConfig.poolConfig.password
    });

    this.connectionPool.execute(this.queries.CreateDatabaseIfNotExists(esConnectionConfig.database))
      .then(db => {
        return this.connectionPool.end();
      }).then(connect => {
        return this.connectionPool = createPool({
          connectionLimit: esConnectionConfig.poolConfig.connectionLimit,
          host: esConnectionConfig.poolConfig.host,
          port: esConnectionConfig.poolConfig.port,
          user: esConnectionConfig.poolConfig.user,
          password: esConnectionConfig.poolConfig.password,
          database: esConnectionConfig.poolConfig.database
        });
      }).then(table => {
        return esConnectionConfig.aggregates.forEach(aggregate => {
          this.connectionPool.execute(this.queries.CreateTableIfNotExists(aggregate)).catch(error => {
            debug('Error trying to create tables, check logs: ', error);
            throw error;
          })
        })
      }).catch(error => {
        debug('Error instantiating class, check logs: ', error);
        throw error;
      })
  }

}