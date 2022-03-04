const express = require("express");
const router = express.Router();
// 数据库
let db = require("../../config/mysql");
// JSON Web Token
const jwt = require("jsonwebtoken");
/**
 * @api {post} /api/admin/register 管理员注册
 * @apiDescription 注册成功，默认角色为运营人员，默认生成头像地址："/images/avatar/default.jpg"， 返回token, 请在头部headers中设置Authorization: `Bearer ${token}`,所有请求都必须携带token;
 * @apiName AdminRegister
 * @apiGroup admin User
 * @apiPermission admin
 *
 * @apiParam { String } username 账户名.
 * @apiParam { String } password 密码.
 * @apiParam { String } fullname 姓名.
 * @apiParam { String } sex 性别.
 * @apiParam { String } tel 手机号码.
 *
 * @apiUse SuccessResponse
 *
 * @apiSampleRequest /api/admin/register
 */
router.post("/register", async (req, res) => {
  let { username, password, fullname, sex, tel } = req.body;
  // 查询账户是否存在
  let sql = `SELECT * FROM ADMIN WHERE username = ?`;
  let results = await db.query(sql, username);
  if (results.length) {
    res.json({
      status: false,
      msg: "账号已经存在！",
    });
    return false;
  }

  sql = `INSERT INTO ADMIN (username,password,fullname,sex,tel,createTime) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP())`;

  results = await db.query(sql, [username, password, fullname, sex, tel]);

  let { insertId, affectedRows } = results;

  if (affectedRows <= 0) {
    res.json({
      status: false,
      msg: "插入失败！",
    });
    return false;
  }

  sql = `INSERT INTO admin_role (adminId,roleId) VALUES (?,3)`;

  results = await db.query(sql, insertId);

  let payload = {
    id: insertId,
    username,
    role: 3,
  };
  // 生成token
  let token = jwt.sign(payload, "secret", { expiresIn: "4h" });
  // 存储成功
  res.json({
    status: true,
    msg: "注册成功！",
    data: {
      token,
      id: insertId,
      role: 3,
    },
  });
});

/**
 * @api {post} /api/admin/login 管理员登录
 * @apiDescription 登录成功， 返回token, 请在头部headers中设置Authorization: `Bearer ${token}`, 所有请求都必须携带token;
 * @apiName AdminLogin
 * @apiGroup admin User
 * @apiPermission admin
 *
 * @apiParam {String} username 账户名.
 * @apiParam {String} password 密码.
 *
 * @apiUse SuccessResponse
 *
 * @apiSampleRequest /api/admin/login
 */

router.post("/login", async (req, res) => {
  let { username, password } = req.body;
  let sql = `SELECT * FROM admin WHERE username = ? AND password = ?`;
  let results = await db.query(sql, [username, password]);
  // 账号密码错误
  if (!results.length) {
    res.json({
      status: false,
      msg: "账号或者密码错误！",
    });
    return false;
  }
  let { adminId } = results[0];
  // 更新登陆时间，登陆次数
  sql = `UPDATE admin SET loginCount = loginCount + 1 WHERE adminId = ?;`;
  let response = await db.query(sql, adminId);
  if (response.affectedRows > 0) {
    // 登录成功
    let payload = {
      id: adminId,
      username,
    };
    // 生成token
    let token = jwt.sign(payload, "secret", { expiresIn: "4h" });
    res.json({
      status: true,
      msg: "登录成功！",
      data: {
        token,
        id: adminId,
      },
    });
  }
});

/**
 * @api {get} /api/admin/adminMenager/list 获取管理员列表
 * @apiName AdminList
 * @apiGroup admin User
 * @apiPermission admin
 *
 */
router.post("/list", async (req, res) => {
  //查询账户数据
  let sql = `SELECT a.adminId,a.username,a.fullname,a.email,a.sex,a.avatar,a.tel,DATE_FORMAT(a.loginTime,'%Y-%m-%d %H:%i:%s') AS loginTime,a.loginCount,r.roleName,r.roleId AS role FROM ADMIN AS a LEFT JOIN admin_role AS ar ON a.adminId = ar.adminId LEFT JOIN role AS r ON r.roleId = ar.roleId ORDER BY a.adminId`;
  let results = await db.query(sql);
  res.json({
    status: true,
    msg: "获取成功！",
    data: results,
  });
});

/**
 * @api {delete} /api/admin/adminMenager/del 删除管理员
 * @apiName DeleteAdmin
 * @apiGroup admin User
 * @apiPermission admin
 *
 * @apiExample {js} 参数示例:
 * /api/admin/3
 *
 * @apiParam {Number} id 账户id.
 *
 * @apiSampleRequest /api/admin
 */
router.post("/del", async (req, res) => {
  let { id } = req.body;
  let sql = `DELETE FROM admin WHERE adminId = ?;DELETE FROM admin_role WHERE adminId = ?;`;
  let results = await db.query(sql, [id, id]);
  if (results.affectedRows <= 0) {
    res.json({
      status: false,
      msg: "删除失败！",
    });
    return false;
  }
  res.json({
    status: true,
    msg: "删除成功！",
  });
});
/**
 * @api {get} /api/admin/info 获取管理员个人资料
 * @apiName AdminInfo
 * @apiGroup admin User
 * @apiPermission admin
 *
 * @apiParam {Number} id 账户id.
 *
 * @apiSampleRequest /api/admin
 */
router.post("/info", async (req, res) => {
  let { id } = req.body;
  //查询账户数据
  let sql = `SELECT * from admin WHERE adminId = ?`;
  let results = await db.query(sql, id);
  if (!results.length) {
    res.json({
      status: false,
      msg: "获取失败！",
    });
    return false;
  }
  // 获取成功
  res.json({
    status: true,
    msg: "获取成功！",
    data: results[0],
  });
});
/**
 * @api { put } /api/admin/update 更新管理员个人资料
 * @apiDescription 只有超级管理员才有权限修改用户角色，普通管理员无权限更改角色。
 * @apiName UpdateInfo
 * @apiGroup admin User
 * @apiPermission 超级管理员
 *
 * @apiParam {Number} id 账户id.
 * @apiParam {String} fullname 姓名.
 * @apiParam {String} sex 性别.
 * @apiParam {String} avatar 头像.
 * @apiParam { String } tel 手机号码.
 * @apiParam { String } email 邮箱地址.
 * @apiParam { String } role 账户角色id.
 *
 * @apiSampleRequest /api/admin
 */
router.post("/update", async (req, res) => {
  let { id, fullname, sex, avatar, tel, email, role } = req.body;
  let sql = `UPDATE admin SET fullname = ?,sex = ?,avatar = ?,tel = ?,email = ? WHERE adminId = ?;
    UPDATE admin_role SET roleId = ? WHERE adminId = ?`;
  let results = await db.query(sql, [
    fullname,
    sex,
    avatar,
    tel,
    email,
    id,
    role,
    id,
  ]);
  if (!results.length) {
    res.json({
      status: false,
      msg: "获取失败！",
    });
    return false;
  }
  // 获取成功
  res.json({
    status: true,
    msg: "获取成功！",
  });
});

/**
 * @api { put } /api/admin/account 修改本账户信息
 * @apiDescription 管理员自行修改本账户信息，但是无权限分配角色。
 * @apiName UpdateAccount
 * @apiGroup admin User
 * @apiPermission admin
 *
 * @apiParam { String } fullname 姓名.
 * @apiParam { String } sex 性别.
 * @apiParam { String } avatar 头像.
 * @apiParam { String } tel 手机号码.
 * @apiParam { String } email 邮箱地址.
 *
 * @apiSampleRequest /api/admin/account
 */
router.post("/account", async (req, res) => {
  let { id } = req.user;
  let { fullname, sex, avatar, tel, email } = req.body;
  let sql = `UPDATE admin SET fullname = ?,sex = ?,avatar = ?,tel = ?,email = ? WHERE adminId = ?`;
  let results = await db.query(sql, [fullname, sex, avatar, tel, email, id]);
  if (!results.affectedRows) {
    res.json({
      status: false,
      msg: "修改失败！",
    });
    return;
  }
  res.json({
    status: true,
    msg: "修改成功！",
  });
});

module.exports = router;
