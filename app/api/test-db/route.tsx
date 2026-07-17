import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import dotenv from 'dotenv'; 
export async function GET() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // simple query to test
    const [rows] = await connection.execute("SELECT 1 + 1 AS result");

    await connection.end();

    return NextResponse.json({
      success: true,
      message: "Database connected successfully ✅",
      data: rows,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "Database connection failed ❌",
      error: error.message,
    });
  }
}