const users = require("../models/User.models");
const { generateToken } = require("../Utils/jwt");
const { hashPassword, comparePassword } = require("../Utils/bcrypt");
const { sendEmail } = require("../Utils/sendEmail");

//  SignUp
const signUp = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const exists = await users.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "User already Exists" });
    }

    const hashedPassword = await hashPassword(password);
    const newUser = await users.create({
      name,
      email,
      password: hashedPassword,
    });

const token = generateToken({
  id: newUser._id,
  name: newUser.name,
  email: newUser.email,
});

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 *  60 * 1000,
    });

    await sendEmail(
      newUser.email,
      "Welcome to AIResumeX",
      `Hello ${newUser.name},
      \n\nThank you for signing up! Your account has been created successfully.\n\nBest regards,\nAIResumeX Team`
    );

    return res.status(201).json({
      message: "User created Successfully",
      user: {id:newUser.id, name: newUser.name, email: newUser.email },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};

// login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "This Email is not registered" });
    }

    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Password is not correct" });
    }

const token = generateToken({
  id: user._id,
  name: user.name,
  email: user.email,
});

    return res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      })
      .json({ message: "Logged in successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "server error" });
  }
};

// logOut
const logout = async (req, res) => {
  try {
    res.clearCookie("token");
    return res.json({ message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "Logout Failed" });
  }
};

const checkAuth = async (req, res) => {

    res.json({ authenticated: true, user: req.user });

}



module.exports = {
  signUp,
  login,
  logout,
  checkAuth,
};
