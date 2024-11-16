import oracledb from 'oracledb';

async function testConnection() {
  try {
    const connection = await oracledb.getConnection({
      user: 'myuser',          // Replace with your actual username
      password: 'mypassword',  // Replace with your actual password
      connectString: 'localhost:1521/FREEPDB1',
    });
    console.log('Connection successful!');

    // Execute a query against your table
    const result = await connection.execute(`
      SELECT ID, MYCOLUMN, COL1, COL2, COL3
      FROM MYTABLE
    `);

    console.log('Query result:', result.rows);

    await connection.close();
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

testConnection();
