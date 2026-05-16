require('dotenv').config();

function parseBoolean(value) {
  return String(value).toLowerCase() === 'true';
}

function parseServer(value) {
  const server = value || 'localhost';
  const [host, instanceName] = server.split('\\');

  return {
    host,
    instanceName
  };
}

const trustedConnection = parseBoolean(process.env.DB_TRUSTED_CONNECTION);
const sql = trustedConnection ? require('mssql/msnodesqlv8') : require('mssql');
const databaseName = process.env.DB_DATABASE || 'AutoSchoolDB';
const parsedServer = parseServer(process.env.DB_SERVER);

const dbConfig = trustedConnection
  ? {
      driver: 'msnodesqlv8',
      connectionString: [
        `Driver={${process.env.DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server'}}`,
        `Server=${process.env.DB_SERVER || 'localhost'}`,
        `Database=${databaseName}`,
        'Trusted_Connection=Yes',
        'TrustServerCertificate=Yes'
      ].join(';') + ';',
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    }
  : {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: parsedServer.host,
      database: databaseName,
      port: parsedServer.instanceName ? undefined : Number(process.env.DB_PORT || 1433),
      options: {
        encrypt: parseBoolean(process.env.DB_ENCRYPT),
        trustServerCertificate: true,
        instanceName: parsedServer.instanceName
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
  }
;

let poolPromise;

function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(dbConfig);
    poolPromise = pool.connect().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }

  return poolPromise;
}

module.exports = {
  sql,
  getPool
};
