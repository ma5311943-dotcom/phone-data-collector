const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const config = require("../config/env");
const ApiError = require("../utils/ApiError");
const {
  requireString,
  requireEmail,
} = require("../utils/validation");
const { sendSuccess } = require("../utils/response");

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

function signToken(user) {
  const expiresIn = /^\d+$/.test(String(config.jwt.expiresIn))
    ? Number(config.jwt.expiresIn)
    : config.jwt.expiresIn;

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn },
  );
}

async function register(req, res) {
  const fullName = requireString(req.body.fullName, "fullName", {
    max: 120,
  });
  const email = requireEmail(req.body.email);
  const password = requireString(req.body.password, "password", {
    min: 8,
    max: 72,
  });

  const passwordHash = await bcrypt.hash(password, 12);

  let user;

  try {
    user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: "STUDENT",
      },
      select: USER_SELECT,
    });
  } catch (error) {
    if (error && error.code === "P2002") {
      throw new ApiError(
        409,
        "An account with this email already exists.",
        "EMAIL_IN_USE",
      );
    }

    throw error;
  }

  return sendSuccess(
    res,
    {
      token: signToken(user),
      tokenType: "Bearer",
      expiresIn: config.jwt.expiresIn,
      user,
    },
    { status: 201 },
  );
}

async function login(req, res) {
  const email = requireEmail(req.body.email);
  const password = requireString(req.body.password, "password", {
    max: 200,
  });

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError(
      401,
      "Invalid email or password.",
      "INVALID_CREDENTIALS",
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(
      401,
      "Invalid email or password.",
      "INVALID_CREDENTIALS",
    );
  }

  if (!user.isActive) {
    throw new ApiError(
      401,
      "This account is not active.",
      "ACCOUNT_INACTIVE",
    );
  }

  return sendSuccess(res, {
    token: signToken(user),
    tokenType: "Bearer",
    expiresIn: config.jwt.expiresIn,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}

async function me(req, res) {
  return sendSuccess(res, req.user);
}

module.exports = { register, login, me };
