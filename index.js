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

app.put("/purchases/:id", async (req, res) => {
  const { id } = req.params;
  const { user_id, status, details } = req.body;

  const connection = await pool.getConnection();

  try {
    const [existingPurchase] = await connection.query(
      "SELECT status FROM purchases WHERE id = ?",
      [id]
    );
    if (existingPurchase.length === 0) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    if (existingPurchase[0].status === "COMPLETED") {
      return res
        .status(400)
        .json({ error: "No se puede modificar una compra COMPLETED" });
    }

    if (details && details.length > 5) {
      return res
        .status(400)
        .json({ error: "No se pueden agregar más de 5 productos" });
    }

    const total = details
      ? details.reduce((sum, item) => sum + item.quantity * item.price, 0)
      : 0;

    if (total > 3500) {
      return res
        .status(400)
        .json({ error: "El total de la compra no puede exceder $3500" });
    }

    await connection.beginTransaction();

    await connection.query(
      "DELETE FROM purchase_details WHERE purchase_id = ?",
      [id]
    );

    if (details && details.length > 0) {
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

        const subtotal = item.quantity * item.price;
        await connection.query(
          "INSERT INTO purchase_details (purchase_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)",
          [id, item.product_id, item.quantity, item.price, subtotal]
        );
      }
    }

    const fields = [];
    const values = [];

    if (user_id) {
      fields.push("user_id = ?");
      values.push(user_id);
    }
    if (status) {
      fields.push("status = ?");
      values.push(status);
    }
    if (details) {
      fields.push("total = ?");
      values.push(total);
    }

    fields.push("purchase_date = NOW()");
    const sql = `UPDATE purchases SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);

    await connection.query(sql, values);
    await connection.commit();

    res.json({ message: "Compra actualizada correctamente" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: "Error al actualizar compra" });
  } finally {
    connection.release();
  }
});

app.get("/purchases", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id AS purchase_id, u.name AS user, p.total, p.status, p.purchase_date,
        d.id AS detail_id, pr.name AS product, d.quantity, d.price, d.subtotal
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      JOIN purchase_details d ON p.id = d.purchase_id
      JOIN products pr ON d.product_id = pr.id
      ORDER BY p.id;
    `);

    const result = [];
    const map = {};

    rows.forEach((row) => {
      if (!map[row.purchase_id]) {
        map[row.purchase_id] = {
          id: row.purchase_id,
          user: row.user,
          total: row.total,
          status: row.status,
          purchase_date: row.purchase_date,
          details: [],
        };
        result.push(map[row.purchase_id]);
      }
      map[row.purchase_id].details.push({
        id: row.detail_id,
        product: row.product,
        quantity: row.quantity,
        price: row.price,
        subtotal: row.subtotal,
      });
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener compras" });
  }
});

app.get("/purchases/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        p.id AS purchase_id, u.name AS user, p.total, p.status, p.purchase_date,
        d.id AS detail_id, pr.name AS product, d.quantity, d.price, d.subtotal
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      JOIN purchase_details d ON p.id = d.purchase_id
      JOIN products pr ON d.product_id = pr.id
      WHERE p.id = ?;
    `,
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Compra no encontrada" });

    const purchase = {
      id: rows[0].purchase_id,
      user: rows[0].user,
      total: rows[0].total,
      status: rows[0].status,
      purchase_date: rows[0].purchase_date,
      details: rows.map((row) => ({
        id: row.detail_id,
        product: row.product,
        quantity: row.quantity,
        price: row.price,
        subtotal: row.subtotal,
      })),
    };

    res.json(purchase);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener compra" });
  }
});

// =====================================
// SERVIDOR
// =====================================

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
