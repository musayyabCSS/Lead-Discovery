/*
# Install pg_net extension for HTTP calls from SQL

## Overview
Installs pg_net to allow making HTTP requests from the database,
so we can trigger the edge function and inspect results.
*/

CREATE EXTENSION IF NOT EXISTS pg_net;
