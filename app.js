const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const session = require("express-session");
require("dotenv").config();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/User");

const Product = require("./models/Product");
const Order = require("./models/Order");

const app = express();

const PORT = 8000;

// ====================
// EJS Setup
// ====================

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ====================
// Middleware
// ====================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(methodOverride("_method"));

app.use(express.static(path.join(__dirname, "public")));

// ====================
// Session
// ====================
const { MongoStore } = require("connect-mongo");

app.use(
    session({
        secret: "codealpha_secret",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URL
        })
    })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ====================
// Home Route
// ====================

app.get("/", (req, res) => {
    res.send("CodeAlpha E-commerce Store is running!");
});

// ====================
// Products Route
// ====================

app.get("/products", async (req, res) => {
    try {
        const products = await Product.find({});
        res.render("products/index", { products });
    } catch (err) {
        console.log(err);
        res.send("Something went wrong");
    }
});

// ====================
// Product Details Route
// ====================

app.get("/products/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);

        if (!product) {
            return res.send("Product not found");
        }

        res.render("products/show", { product });
    } catch (err) {
        console.log(err);
        res.send("Something went wrong");
    }
});

// Register Page
app.get("/register", (req, res) => {
    res.render("users/register");
});

// Register User
app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const newUser = new User({
            username: username,
            email: email
        });

        const registeredUser = await User.register(newUser, password);

        req.login(registeredUser, (err) => {
            if (err) {
                return res.send("Login error");
            }

            res.redirect("/products");
        });
    } catch (err) {
        console.log(err);
        res.send("Registration failed");
    }
});

// Login Page
app.get("/login", (req, res) => {
    res.render("users/login");
});

// Login User
app.post(
    "/login",
    passport.authenticate("local", {
        failureRedirect: "/login"
    }),
    (req, res) => {
        res.redirect("/products");
    }
);

// ====================
// Add To Cart
// ====================

app.post("/cart/add/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);

        if (!product) {
            return res.send("Product not found");
        }

        // Create cart if it doesn't exist
        if (!req.session.cart) {
            req.session.cart = [];
        }

        // Check if product already exists
        const existingProduct = req.session.cart.find(
            (item) => item.productId === id
        );

        if (existingProduct) {
            existingProduct.quantity += 1;
        } else {
            req.session.cart.push({
                productId: id,
                quantity: 1
            });
        }

        res.redirect("/cart");
    } catch (err) {
        console.log(err);
        res.send("Something went wrong");
    }
});

// ====================
// Cart Page
// ====================

app.get("/cart", async (req, res) => {
    try {
        const cart = req.session.cart || [];

        const products = [];

        for (const item of cart) {
            const product = await Product.findById(item.productId);

            if (product) {
                products.push({
                    product: product,
                    quantity: item.quantity
                });
            }
        }

        res.render("cart/index", { products });
    } catch (err) {
        console.log(err);
        res.send("Something went wrong");
    }
});

// Checkout
app.post("/checkout", async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.redirect("/login");
        }

        const cart = req.session.cart || [];

        if (cart.length === 0) {
            return res.send("Your cart is empty");
        }

        const items = [];
        let totalAmount = 0;

        for (const item of cart) {
            const product = await Product.findById(item.productId);

            if (product) {
                items.push({
                    product: product._id,
                    quantity: item.quantity,
                    price: product.price
                });

                totalAmount += product.price * item.quantity;
            }
        }

        const order = new Order({
            user: req.user._id,
            items: items,
            totalAmount: totalAmount
        });

        await order.save();

        // Clear cart after order
        req.session.cart = [];

        res.redirect("/orders");
    } catch (err) {
        console.log(err);
        res.send("Order processing failed");
    }
});

// My Orders
app.get("/orders", async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.redirect("/login");
        }

        const orders = await Order.find({
            user: req.user._id
        }).populate("items.product");

        res.render("orders/index", { orders });
    } catch (err) {
        console.log(err);
        res.send("Something went wrong");
    }
});

//logout
app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }

        res.redirect("/products");
    });
});

// ====================
// MongoDB Connection
// ====================

mongoose
    .connect(process.env.MONGO_URL)
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.log("MongoDB connection error:", err);
    });

// ====================
// Server
// ====================

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});