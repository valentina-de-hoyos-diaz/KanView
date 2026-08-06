const express = require('express')
const mongoose = require('./config/connectiondb')
require('dotenv').config()
const app = express()


app.listen(process.env.PORT || 9998); 