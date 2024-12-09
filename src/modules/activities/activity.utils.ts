import { ActivityType } from "@/common/enums";
import { activityModel } from "@/db/schemas";
import type { TSelectActivitySchema } from "@/db/schemas/activity.model";

import type { IActivityMetadata } from "./activity.types";

export function activitySortBy(sortBy: string | undefined) {
  if (sortBy === "updatedAt") {
    return activityModel.updatedAt;
  } else {
    return activityModel.createdAt;
  }
}

export function organizeActivities(
  activities: (Omit<TSelectActivitySchema, "metadata"> & {
    metadata: unknown;
  })[],
  userId: string | undefined,
) {
  return activities.map((activity) => {
    if (activity.type.includes("category")) {
      return formatCategoryActivity(
        activity.id,
        activity.metadata as IActivityMetadata,
        userId,
      );
    }

    if (activity.type.includes("group")) {
      return formatGroupActivity(
        activity.id,
        activity.metadata as IActivityMetadata,
        userId,
        activity.type,
      );
    }

    return {
      id: activity.id,
      message: "Unknown activity",
    };
  });
}

function formatCategoryActivity(
  id: string,
  activityMetadata: IActivityMetadata,
  userId: string | undefined,
) {
  switch (activityMetadata.action) {
    case "create":
      return {
        id,
        message: `${userId ? activityMetadata.actorName : "You"} created a new category "${activityMetadata.resourceName}"`,
      };
    case "update":
      return {
        id,
        message: `${userId ? activityMetadata.actorName : "You"} updated the category "${activityMetadata.resourceName}"`,
      };
    case "delete":
      return {
        id,
        message: `${userId ? activityMetadata.actorName : "You"} deleted the category "${activityMetadata.resourceName}"`,
      };
    default:
      return { id: "", message: "Unknown category activityMetadata" };
  }
}

function formatGroupActivity(
  id: string,
  activityMetadata: IActivityMetadata,
  userId: string | undefined,
  activityType: string,
) {
  if (activityType === ActivityType.GROUP_MEMBER_ADDED) {
    return {
      id,
      message: `${userId ? activityMetadata.actorName : "You"} added ${activityMetadata.targetName} to the Group "${activityMetadata.resourceName}"`,
    };
  }

  switch (activityMetadata.action) {
    case "create":
      return {
        id,
        message: `${userId ? activityMetadata.actorName : "You"} created a new Group "${activityMetadata.resourceName}"`,
      };
    case "update":
      return {
        id,
        message: `${userId ? activityMetadata.actorName : "You"} updated the Group "${activityMetadata.resourceName}"`,
      };
    case "delete":
      return {
        id,
        message: `${userId ? activityMetadata.actorName : "You"} deleted the Group "${activityMetadata.resourceName}"`,
      };
    default:
      return { id: "", message: "Unknown group activityMetadata" };
  }
}
