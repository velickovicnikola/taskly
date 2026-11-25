require('dotenv').config();
const { Pool, types } = require('pg');

// Return DATE columns (OID 1082) as plain 'YYYY-MM-DD' strings, avoiding timezone shifts
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

module.exports = pool;