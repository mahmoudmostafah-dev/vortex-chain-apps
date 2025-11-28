// src/services/logger.js - خدمة التسجيل

const fs = require('fs');
const path = require('path');

class LoggerService {
  constructor(config) {
    this.config = config;
    this.logDir = config.logging.logDir;
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFilePath() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${date}.log`);
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;

    const logFile = this.getLogFilePath();
    fs.appendFileSync(logFile, logEntry);

    console.log(logEntry.trim());
  }

  info(message) {
    this.log('INFO', message);
  }

  warning(message) {
    this.log('WARNING', message);
  }

  error(message) {
    this.log('ERROR', message);
  }

  success(message) {
    this.log('SUCCESS', message);
  }

  trade(message) {
    this.log('TRADE', message);
  }

  critical(message) {
    this.log('CRITICAL', message);
  }
}

module.exports = LoggerService;
