import { User } from "../onelogin/OneLoginClient";

import {
  GROUP_ENTITY_TYPE,
  USER_ENTITY_TYPE,
  USER_GROUP_RELATIONSHIP_CLASS,
  USER_GROUP_RELATIONSHIP_TYPE,
  UserGroupRelationship,
} from "../jupiterone";

import generateKey from "../utils/generateKey";

export function createUserGroupRelationships(users: User[]) {
  const defaultValue: UserGroupRelationship[] = [];

  return users.reduce((acc, user) => {
    if (!user.group_id) {
      return acc;
    }

    const parentKey = generateKey(GROUP_ENTITY_TYPE, user.group_id);
    const childKey = generateKey(USER_ENTITY_TYPE, user.id);

    const relationship: UserGroupRelationship = {
      _class: USER_GROUP_RELATIONSHIP_CLASS,
      _fromEntityKey: parentKey,
      _key: `${parentKey}_assigned_${childKey}`,
      _type: USER_GROUP_RELATIONSHIP_TYPE,
      _toEntityKey: childKey,
    };

    return [...acc, relationship];
  }, defaultValue);
}
