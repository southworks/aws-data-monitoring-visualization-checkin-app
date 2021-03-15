"use strict";
const casual = require("casual");
const localConfig = require("../config.json");

const UserRepository = require("../../../cdk/lib/lambdas/src/data/repositories/UserRepository");
const DynamoDbContext = require("../../../cdk/lib/lambdas/src/data/contexts/DynamoDbContext");


class SeedUsers {
  constructor() {
    this.feelingRepository = new UserRepository(new DynamoDbContext());
    this.users = [];
    this.admins = localConfig.totalAdmins;
    this.usersPerAdmin = localConfig.usersPerAdmin;



    casual.define("user", function (administratorId) {
      return {
        id: casual.uuid,
        email: casual.email,
        password: casual.password,
        firstName: casual.first_name,
        lastName: casual.last_name,
        age: casual.integer(18, 80).toString(),
        country: casual.country,
        city: casual.city,
        address: casual.address,
        administratorId: administratorId ? administratorId : "null",
      };
    });

  }

  async persist(user) {
    await this.feelingRepository.create(user);
  }

  generateUsers() {
    for (let i = 0; i < this.admins; i++) {
      let admin = casual.user(null);
      this.persist(admin);
      for (let i = 0; i < this.usersPerAdmin; i++) {
        let user = casual.user(admin.id);
        this.persist(user);
        this.users.push(user);
      }
    }
    return this.users;
  }
}

module.exports = SeedUsers;
