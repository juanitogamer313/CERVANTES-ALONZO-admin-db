const express = require("express");
const app = express();
const port = 3000;

app.use(express.json());

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "database-juancervantes.c0jwuiugq1ef.us-east-1.rds.amazonaws.com",
  user: "admin",
  password: "juanfelipeca151205",
  database: "tienda",
});

app.get("/", (req, res) => {
  res.send("Servidor funcionando correctamente");
});

// =====================================
// USERS
// =====================================

app.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users");
    res.json(rows);
  } catch (err) {
    console.error("Error ejecutando consulta", err);
    res.status(500).send("Error obteniendo usuarios");
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error ejecutando consulta", err);
    res.status(500).send("Error obteniendo usuario");
  }
});

app.post("/users", async (req, res) => {
  const { name, email, status } = req.body;
  if (!name || !email)
    return res.status(400).json({ error: "name y email son obligatorios" });

  try {
    const sql =
      "INSERT INTO users (name, email, created_at, status) VALUES (?, ?, NOW(), ?)";
    const [result] = await pool.query(sql, [name, email, status || 1]);
    res.status(201).json({ message: "Usuario creado", id: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "El email ya está registrado" });
    }
    console.error("Error creando usuario", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ message: "Usuario eliminado correctamente" });
  } catch (err) {
    console.error("Error eliminando usuario", err);
    res.status(500).send("Error eliminando usuario");
  }
});

// =====================================
// PRODUCTS
// =====================================

app.get("/products", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM products");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ error: "Producto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener producto" });
  }
});

app.post("/products", async (req, res) => {
  const { name, description, price, stock, image } = req.body;
  if (!name || !price || !stock)
    return res.status(400).json({ error: "Campos obligatorios" });

  try {
    const sql =
      "INSERT INTO products (name, description, price, stock, image, created_at) VALUES (?, ?, ?, ?, ?, NOW())";
    const [result] = await pool.query(sql, [
      name,
      description,
      price,
      stock,
      image,
    ]);
    res.status(201).json({ id: result.insertId, message: "Producto agregado" });
  } catch (err) {
    res.status(500).json({ error: "Error al crear producto" });
  }
});

app.put("/products/:id", async (req, res) => {
  const { name, description, price, stock, image } = req.body;
  const { id } = req.params;
  try {
    const sql =
      "UPDATE products SET name=?, description=?, price=?, stock=?, image=? WHERE id=?";
    const [result] = await pool.query(sql, [
      name,
      description,
      price,
      stock,
      image,
      id,
    ]);
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ message: "Producto actualizado" });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM products WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ message: "Producto eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

// =====================================
// SERVIDOR
// =====================================

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
