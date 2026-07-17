<?php
// db.php - Database connection for webhook

$DB_HOST = 'localhost';
$DB_PORT = 3306;
$DB_USER = 'bovtt_user';
$DB_PASSWORD = 'secure_password';
$DB_NAME = 'bovtt_db';

// Create connection
$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASSWORD, $DB_NAME, $DB_PORT);

// Check connection
if ($conn->connect_error) {
    error_log("Database Connection Error: " . $conn->connect_error);
    die(json_encode(["error" => "Database connection failed"]));
}

// Set charset to utf8mb4
if (!$conn->set_charset("utf8mb4")) {
    error_log("Error setting charset: " . $conn->error);
}

// Set timezone to UTC
date_default_timezone_set('UTC');

?>
