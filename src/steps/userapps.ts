import {
  createDirectRelationship,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import {
  createPersonalAppEntity,
  convertAWSRolesToRelationships,
} from '../converters';
import {
  UserEntity,
  AppEntity,
  IdEntityMap,
  PERSONAL_APP_ENTITY_TYPE,
  PERSONAL_APP_ENTITY_CLASS,
  USER_PERSONAL_APP_RELATIONSHIP_TYPE,
  USER_ENTITY_TYPE,
  USER_APP_RELATIONSHIP_TYPE,
  APP_ENTITY_TYPE,
  USER_AWS_IAM_ROLE_RELATIONSHIP_TYPE,
  AWS_IAM_ROLE_ENTITY_TYPE,
} from '../jupiterone';

export async function fetchUserApps({
  instance,
  jobState,
  logger,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const apiClient = createAPIClient(instance.config, logger);

  const userEntities = await jobState.getData<UserEntity[]>('USER_ARRAY');

  if (!userEntities) {
    throw new IntegrationMissingKeyError(
      `Expected to find User entity array in jobState.`,
    );
  }

  const appByIdMap = await jobState.getData<IdEntityMap<AppEntity>>(
    'APPLICATION_BY_ID_MAP',
  );

  if (!appByIdMap) {
    throw new IntegrationMissingKeyError(
      `Expected to find appByIdMap in jobState.`,
    );
  }

  for (const userEntity of userEntities) {
    await apiClient.iterateUserApps(userEntity.id, async (userApp) => {
      const appEntity = appByIdMap[userApp.id];
      if (appByIdMap[userApp.id]) {
        //in this case, it is an organization app
        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.ASSIGNED,
            from: userEntity,
            to: appEntity,
          }),
        );

        // check for AWS IAM mapping
        // When an Onelogin application represents access to an AWS Account (the application
        // has a parameter of `parameters['https://aws.amazon.com/SAML/Attributes/Role'`),
        // the application parameter may have defined a property `awsRolesUserAttribute` that
        // contains a string of the name of the user property, which itself should have
        // a comma-delimited string of the Roles in AWS for this user.
        if (appEntity.awsRolesUserAttribute) {
          const userAttribute: string = appEntity.awsRolesUserAttribute!;
          try {
            console.log(`the value to cehck is ${userAttribute}`);
            console.log(userEntity);
            const userRolesValue: string = String(userEntity[userAttribute]);
            const roles = userRolesValue.split(',');
            console.log(roles);
            const awsRelationships = convertAWSRolesToRelationships(
              userEntity,
              roles,
              USER_AWS_IAM_ROLE_RELATIONSHIP_TYPE,
            );
            for (const rel of awsRelationships) {
              if (!jobState.hasKey(rel._key)) {
                await jobState.addRelationship(rel);
              }
            }
          } catch (err) {
            //we couldn't map to AWS IAM Roles for this user
            //not the end of the world
          }
        }
      }

      //documentation and experiments suggest that a user's personal apps
      //are not reported by the API, but just in case they are:
      if (!appByIdMap[userApp.id] && userApp.personal === true) {
        const personalAppEntity = await jobState.addEntity(
          createPersonalAppEntity(userApp),
        );
        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.HAS,
            from: userEntity,
            to: personalAppEntity,
          }),
        );
      }
    });
  }
}

export const userAppSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-userapps',
    name: 'Fetch User Apps',
    entities: [
      {
        resourceName: 'Onelogin Personal Application',
        _type: PERSONAL_APP_ENTITY_TYPE,
        _class: PERSONAL_APP_ENTITY_CLASS,
      },
    ],
    relationships: [
      {
        _type: USER_APP_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ASSIGNED,
        sourceType: USER_ENTITY_TYPE,
        targetType: APP_ENTITY_TYPE,
      },
      {
        _type: USER_AWS_IAM_ROLE_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ASSIGNED,
        sourceType: USER_ENTITY_TYPE,
        targetType: AWS_IAM_ROLE_ENTITY_TYPE,
      },
      {
        _type: USER_PERSONAL_APP_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: USER_ENTITY_TYPE,
        targetType: PERSONAL_APP_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-users', 'fetch-applications'],
    executionHandler: fetchUserApps,
  },
];
