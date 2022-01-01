const request = require("supertest");
const { assert, expect } = require("chai");
const app = require("../index.js");

const serverFunctions = require("../src/controller");
require("dotenv").config();
const mysql = require("mysql");

let server;

describe("Home Page", () => {

  beforeEach(async () => {
    // console.log("=== before each ===");
    server = require("../index.js");
  });

  afterEach(() => {
    // console.log("=== after each ===");
    server.close();
  })

  describe("Server functions", async () => {

    it("fetches all of a user's queries", async () => {

    });
  });

  describe("Authentication", async () => {

    // it("testing", async () => {
    //   const response = await request(server).get("/");
    // });

    it("replies with a 401 error code when logging in with an incorrect email or password", async () => {
      const invalidEmail = "test@gmail.com";
      const invalidPassword = "passwordd";
  
      const response = await request(server)
          .post("/api/users/auth")
          .send({ email: invalidEmail, password: invalidPassword });
      console.log(response.status);
      assert.equal(response.status, 401);
    })

    it("replies with a 200 status code when logging in with a valid email and username", async () => {
      const validEmail = "test@gmail.com";
      const validPassword = "password";

      const response = await request(server)
        .post("/api/users/auth")
        .send({ email: validEmail, password: validPassword });
      console.log(response.status);
      assert.equal(response.status, 200);
    });

  });

});