// Abilita ES modules
require = require("esm")(module);
require("dotenv").config();
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const port = 3000;

// Configura Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotte
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "views/index.html")),
);
app.get("/auth", (req, res) =>
  res.sendFile(path.join(__dirname, "views/auth.html")),
);
app.get("/create", (req, res) =>
  res.sendFile(path.join(__dirname, "views/faq-create.html")),
);
// Aggiungi questa route
app.post("/api/faqs", async (req, res) => {
  const { data, error } = await supabase.from("faqs").insert([req.body]);

  error ? res.status(500).json({ error }) : res.json(data);
});

// API per FAQ
app.get("/api/faqs", async (req, res) => {
  const { category } = req.query;
  let query = supabase.from("faqs").select("*");

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  error ? res.status(500).json({ error }) : res.json(data);
});

app.listen(port, () => console.log(`Server running on port ${port}`));
