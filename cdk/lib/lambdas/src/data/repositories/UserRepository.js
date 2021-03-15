const user = require("../../models/User");
const { getValueOrDefault } = require("./../../utils/utils");
const BaseRepository = require("./base/BaseRepository");
const config = require("./../../config.json");

class UserRepository extends BaseRepository {
  constructor(dbContext) {
    super(dbContext, config.aws.dynamoDB.userTable.name);
  }

  mapItemToEntity(item) {
    const userMapped = {
      id: getValueOrDefault(item, "id.S", null),
      email: getValueOrDefault(item, "email.S", null),
      password: getValueOrDefault(item, "password.S", null),
      firstName: getValueOrDefault(item, "firstName.S", null),
      lastName: getValueOrDefault(item, "lastName.S", null),
      age: getValueOrDefault(item, "age.N", null),
      country: getValueOrDefault(item, "country.S", null),
      city: getValueOrDefault(item, "city.S", null),
      address: getValueOrDefault(item, "address.S", null),
      administratorId: getValueOrDefault(item, "administratorId.S", null),
    };

    return new User(
      userMapped.id,
      userMapped.email,
      userMapped.password,
      userMapped.firstName,
      userMapped.lastName,
      userMapped.age,
      userMapped.country,
      userMapped.city,
      userMapped.address,
      userMapped.administratorId
    );
  }

  mapItemsToEntities(items) {
    const mappedUsers = [];
    items.forEach((item) => {
      mappedUsers.push(this.mapItemToEntity(item));
    });
    return mappedUsers;
  }

  mapEntityToItem(user) {
    return {
      id: {
        S: user.id,
      },
      email: {
        S: user.email,
      },
      password: {
        S: user.password,
      },
      firstName: {
        S: user.firstName,
      },
      lastName: {
        S: user.lastName,
      },
      age: {
        N: user.age,
      },
      country: {
        S: user.country,
      },
      city: {
        S: user.city,
      },
      address: {
        S: user.address,
      },
      administratorId: {
        S: user.administratorId,
      },
    };
  }
}

module.exports = UserRepository;
