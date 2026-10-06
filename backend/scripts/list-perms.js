'use strict';
require('dotenv').config();
const { pool } = require('../config/db');

(async () => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT name, module FROM permissions ORDER BY module, name');
    console.log(JSON.stringify(rows.map(r => r.module + '.' + r.name), null, 2));
  } finally { conn.release(); await pool.end(); }
})();
