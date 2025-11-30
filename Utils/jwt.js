const jwt = require('jsonwebtoken')

const jwtSecret = process.env.JWT_SECRET;

const generateToken = (user)=>{
    const token = jwt.sign({id: user.id,email: user.email,name:user.name}, jwtSecret,);
    return token;
}

const verifyToken = (token)=>{
    const decode = jwt.verify(token, jwtSecret);
    return decode;
}

module.exports = {generateToken, verifyToken};