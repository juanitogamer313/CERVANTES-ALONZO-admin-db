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
// PURCHASES
// =====================================

app.post("/purchases", async (req, res) => {
  const { user_id, status, details } = req.body;
  if (!user_id || !status || !details || details.length === 0)
    return res.status(400).json({ error: "Campos obligatorios" });

  if (details.length > 5)
    return res
      .status(400)
      .json({ error: "No se pueden agregar más de 5 productos" });

  const total = details.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  if (total > 3500)
    return res
      .status(400)
      .json({ error: "El total de la compra no puede exceder $3500" });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of details) {
      const [product] = await connection.query(
        "SELECT stock FROM products WHERE id = ?",
        [item.product_id]
      );
      if (product.length === 0 || product[0].stock < item.quantity) {
        await connection.rollback();
        return res.status(400).json({
          error: `Stock insuficiente para el producto ID ${item.product_id}`,
        });
      }
      await connection.query(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        [item.quantity, item.product_id]
      );
    }

    const [purchaseResult] = await connection.query(
      "INSERT INTO purchases (user_id, total, status, purchase_date) VALUES (?, ?, ?, NOW())",
      [user_id, total, status]
    );

    for (const item of details) {
      const subtotal = item.quantity * item.price;
      await connection.query(
        "INSERT INTO purchase_details (purchase_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)",
        [
          purchaseResult.insertId,
          item.product_id,
          item.quantity,
          item.price,
          subtotal,
        ]
      );
    }

    await connection.commit();
    res
      .status(201)
      .json({ id: purchaseResult.insertId, message: "Compra creada" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: "Error creando compra" });
  } finally {
    connection.release();
  }
});

// =====================================
// SERVIDOR
// =====================================

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
