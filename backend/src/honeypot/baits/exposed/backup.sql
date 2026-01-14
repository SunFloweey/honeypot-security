-- MySQL dump 10.13  Distrib 8.0.26
--
-- Host: localhost    Database: secureapp_prod
-- ------------------------------------------------------

-- Table structure for table 'users'

DROP TABLE IF EXISTS 'users';
CREATE TABLE 'users' (
  'id' int NOT NULL AUTO_INCREMENT,
  'username' varchar(255) NOT NULL,
  'email' varchar(255) NOT NULL,
  'password' varchar(255) NOT NULL,
  'role' enum('user','admin','superadmin') DEFAULT 'user',
  'created_at' timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ('id'),
  UNIQUE KEY 'email' ('email')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dumping data for table 'users'

INSERT INTO 'users' VALUES 
(1,'admin','admin@secureapp.com','$2b$10$N9qo8uLOickgx2ZMRZoMye', 'admin','2024-01-15 10:30:00'),
(2,'john.doe','john@example.com','$2b$10$abcdefghijklmnopqrstuv', 'user','2024-03-22 14:20:00'),
(3,'jane.smith','jane@example.com','$2b$10$zyxwvutsrqponmlkjihgfe', 'moderator','2024-05-10 09:15:00');

-- Table structure for table 'api_keys'

DROP TABLE IF EXISTS 'api_keys';
CREATE TABLE 'api_keys' (
  'id' int NOT NULL AUTO_INCREMENT,
  'user_id' int NOT NULL,
  'key' varchar(255) NOT NULL,
  'name' varchar(255) DEFAULT NULL,
  'created_at' timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ('id')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO 'api_keys' VALUES
(1,1,'sk_live_abc123xyz789','Production Key','2025-06-15 10:00:00'),
(2,1,'sk_test_def456uvw012','Development Key','2025-08-20 14:30:00');
