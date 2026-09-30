const mongoose = require("mongoose");
const Product = require("../models/Product");
const { data } = require("./data");

require("dotenv").config();

mongoose.connect(process.env.MONGO_URL)
    .then(async () => {
        console.log("Connected to MongoDB");

        await Product.deleteMany({});
        await Product.insertMany(data);

        console.log("Sample products added successfully");

        await mongoose.connection.close();
    })
    .catch((err) => {
        console.log("MongoDB connection error:", err);
    });