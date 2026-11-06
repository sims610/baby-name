-- Lets the app user create and use the test databases (littleroots_test_1, _2, ...).
-- Jest gives each worker its own database so test files can run in parallel.
-- Runs once, when the Docker volume is first created.
GRANT ALL PRIVILEGES ON `littleroots\_test%`.* TO 'littleroots'@'%';
