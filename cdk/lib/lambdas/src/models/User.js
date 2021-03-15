const Entity = require("./base/Entity");

class User extends Entity {
  constructor(
    id,
    email,
    password,
    firstName,
    lastName,
    age,
    country,
    city,
    address,
    administratorId
  ) {
    super(id);
    this.email = email;
    this.password = password;
    this.firstName = firstName;
    this.lastName = lastName;
    this.age = age;
    this.country = country;
    this.city = city;
    this.address = address;
    this.administratorId = administratorId;
  }
}

module.exports = User;
