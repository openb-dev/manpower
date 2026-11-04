import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const dbHost = process.env.DB_HOST === "localhost" ? "127.0.0.1" : (process.env.DB_HOST || "127.0.0.1");

const config = {
  host: dbHost,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
};

const bootstrap = await mysql.createConnection(config);
await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
await bootstrap.end();

const pool = mysql.createPool({
  ...config,
  database: process.env.DB_NAME,
});

export default pool;
