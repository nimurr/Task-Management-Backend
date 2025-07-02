const { jwt } = require("../config/config");
const { Member, SubTask, Task } = require("../models");
const ApiError = require("../utils/ApiError");
const jwtToken = require('jsonwebtoken');


const createMember = async (data) => {
    try {
        // 1️⃣ Check if the member already exists
        const memberExist = await Member.findOne({ email: data.email });

        if (memberExist) {
            throw new ApiError(400, "This email already exists");
        }

        // 2️⃣ Validate required fields
        if (!data.memberName || !data.email || !data.location || !data.password || !data.role) {
            throw new ApiError(400, "All fields are required");
        }

        // 3️⃣ Validate password length & Hash Password
        if (data.password.length < 6) {
            throw new ApiError(400, "Password must be at least 6 characters");

        }


        const minDailyTasks = await Task.find({ _id: data.dailyMainTaskId });
        const minWeeklyTasks = await Task.find({ _id: data.weeklyMainTaskId });
        // 4️⃣ Fetch Daily & Weekly Tasks based on the provided IDs


        const tasks = minDailyTasks[0]?.subTasks || [];
        const updatedTasks = await Promise.all(
            tasks.map(async (taskId) => {
                // console.log("Task ID:", taskId);
                const updatedTask = await SubTask.findById(taskId);
                // console.log("Updated Task:", updatedTask);
                return updatedTask;
            })
        );
        const weeklyTaskssdsdf = minWeeklyTasks[0]?.subTasks || [];
        const updatedWeeklyTasks = await Promise.all(
            weeklyTaskssdsdf.map(async (taskId) => {
                // console.log("Task ID:", taskId);
                const updatedTask = await SubTask.findById(taskId);
                console.log("Updated Task:", updatedTask);
                return updatedTask;
            })
        );


        let dailyTaskIds = [];
        let weeklyTaskIds = [];

        if (minWeeklyTasks[0]?.taskType === "Weekly") {
            updatedWeeklyTasks.forEach((task) => {
                weeklyTaskIds.push(task._id);
            })
        }

        if (minDailyTasks[0]?.taskType === "Daily") {
            updatedTasks.forEach((task) => {
                dailyTaskIds.push(task._id);
            })

        }


        // console.log(dailyTaskIds);

        // Fetch all tasks in myDailyTasks and myWeeklyTasks
        const dailyTasks = await SubTask.find({ _id: { $in: dailyTaskIds } });
        const weeklyTasks = await SubTask.find({ _id: { $in: weeklyTaskIds } });

        // console.log("my Daily Tasks:", dailyTasks, "my Weekly Tasks:", weeklyTasks);

        // 5️⃣ Update Daily & Weekly Subtasks
        if (dailyTaskIds.length > 0) {
            await SubTask.updateMany(
                { _id: { $in: dailyTaskIds } },
                { $set: { userEmail: data.email, taskType: "Daily", managerId: data.assignedManager } }
            );
        }
        if (weeklyTaskIds.length > 0) {
            await SubTask.updateMany(
                { _id: { $in: weeklyTaskIds } },
                { $set: { userEmail: data.email, taskType: "Weekly", managerId: data.assignedManager } }
            );
        }

        // 6️⃣ Update`totalAssignedCustomer` in Task
        if (data.mainTaskId) {
            const task = await SubTask.findById(data.mainTaskId);
            if (task) {
                task.totalAssignedCustomer = (task.totalAssignedCustomer || 0) + 1;
                await task.save();
            }
        }

        // 7️⃣ Get Assigned Manager Name (if exists)
        let assignedManagerName = "";
        if (data.assignedManager) {
            const manager = await Member.findById(data.assignedManager);
            if (manager) {
                assignedManagerName = manager.memberName;
            }
        }


        if (dailyTaskIds[0] || weeklyTaskIds[0]) {
            const task = await SubTask.findById(dailyTaskIds[0] || weeklyTaskIds[0]);
            if (task) {
                task.totalAssignedCustomer = (task.totalAssignedCustomer || 0) + 1;
                task.save();
            }
        }


        // 8️⃣ Create the new Member
        const newMemberData = {
            memberName: data.memberName,
            location: data.location,
            email: data.email,
            password: data.password, // Store hashed password
            role: data.role,

            assignedManager: data.assignedManager || null,
            dailyTitle: data.dailyTitle || "",
            dailyDescription: data.dailyDescription || "",
            weeklyTitle: data.weeklyTitle || "",
            weeklyDescription: data.weeklyDescription || "",
            myDailyTasks: dailyTasks.length > 0 ? dailyTasks.map(task => task._id) : [],
            myWeeklyTasks: weeklyTasks.length > 0 ? weeklyTasks.map(task => task._id) : [],

            mainTaskId: data.mainTaskId,
            assignedManagerName: assignedManagerName || "", 
            dailyMainTaskId: data.dailyMainTaskId || null,
            weeklyMainTaskId: data.weeklyMainTaskId || null,
        };



        // Create the new member in the database
        const newMember = await Member.create(newMemberData);

        return newMember;
    } catch (error) {
        throw new ApiError(500, error.message);
    }
};


const getSingleMember = async (id) => {
    try {
        // Find member by ID and select only the required fields
        const member = await Member.findById(id).select(
            "_id memberName profileImage location email role password userActivity assignedManagerName myDailyTasks myWeeklyTasks mainTaskId dailyTitle dailyDescription weeklyTitle weeklyDescription assignedManager assignedManagerName totalAssignedCustomer dailyMainTaskId weeklyMainTaskId"
        )
            .populate("assignedManager", "memberName")
            .populate('myDailyTasks', 'subTaskName')
            .populate('myWeeklyTasks', 'subTaskName')

            .populate('dailyMainTaskId')
            .populate('weeklyMainTaskId');


        if (!member) {
            throw new ApiError(404, "Member not found");
        }
        return member;
    } catch (error) {
        throw new ApiError(500, error.message);
    }
};


// Get all members
const getAllMembers = async () => {
    try {

        // Fetch members while excluding `myDailyTasks` and `myWeeklyTasks`
        const members = await Member.find({}, { myDailyTasks: 0, myWeeklyTasks: 0 });


        return members;
    } catch (error) {
        throw new ApiError(500, error.message);
    }
};

const getAllCustomer = async () => {
    try {
        const members = await Member.find({ role: "customer" })
            .populate("assignedManager", "memberName")
            .populate('myWeeklyTasks')
            .populate('myDailyTasks');

        // members.map((member) => {
        //     const res = Member.updateOne({ _id: '67a6bcc48c4081a380b6ac0d' }, { $set: { assignedManagerName: member.assignedManagerName } });
        //     console.log(res);
        // })

        return {
            members,
            totalCustomer: members.length
        };
    } catch (error) {
        throw new ApiError(500, error.message);
    }
};

// Update a member by ID
const updateMember = async (id, data) => {
    try {
        // 1️⃣ Check if the member exists by ID
        const member = await Member.findById(id);
        if (!member) {
            throw new ApiError(404, "Member not found");
        }

        // 2️⃣ Validate required fields (if you want strict validation on update)
        if (!data.memberName || !data.email || !data.location || !data.role) {
            throw new ApiError(400, "memberName, email, location and role are required");
        }

        // 3️⃣ Validate password length if password provided
        if (data.password && data.password.length < 6) {
            throw new ApiError(400, "Password must be at least 6 characters");
        }

        const minDailyTasks = await Task.find({ _id: data.dailyMainTaskId });
        const minWeeklyTasks = await Task.find({ _id: data.weeklyMainTaskId });
        // 4️⃣ Fetch Daily & Weekly Tasks based on the provided IDs

        // console.log("minDailyTasks:", minDailyTasks, "minWeeklyTasks:", minWeeklyTasks);

        const tasks = minDailyTasks[0]?.subTasks || [];
        const updatedTasks = await Promise.all(
            tasks.map(async (taskId) => {
                // console.log("Task ID:", taskId);
                const updatedTask = await SubTask.findById(taskId);
                // console.log("Updated Task:", updatedTask);
                return updatedTask;
            })
        );
        const weeklyTaskssdsdf = minWeeklyTasks[0]?.subTasks || [];
        const updatedWeeklyTasks = await Promise.all(
            weeklyTaskssdsdf.map(async (taskId) => {
                // console.log("Task ID:", taskId);
                const updatedTask = await SubTask.findById(taskId);
                // console.log("Updated Task:", updatedTask);
                return updatedTask;
            })
        );

        console.log("updatedTasks", updatedTasks);


        let dailyTaskIds = [];
        let weeklyTaskIds = [];



        await updatedWeeklyTasks.forEach((task) => {
            weeklyTaskIds.push(task._id);
        })



        await updatedTasks.forEach((task) => {
            dailyTaskIds.push(task._id);
        })



        // Fetch all tasks in myDailyTasks and myWeeklyTasks
        const dailyTasks = await SubTask.find({ _id: { $in: dailyTaskIds } });
        const weeklyTasks = await SubTask.find({ _id: { $in: weeklyTaskIds } });



        // 8️⃣ Update SubTasks: assign userEmail, taskType and managerId for daily and weekly subtasks
        if (dailyTaskIds.length > 0) {
            await SubTask.updateMany(
                { _id: { $in: dailyTaskIds } },
                { $set: { userEmail: data.email, taskType: "Daily", managerId: data.assignedManager } }
            );
        }

        if (weeklyTaskIds.length > 0) {
            await SubTask.updateMany(
                { _id: { $in: weeklyTaskIds } },
                { $set: { userEmail: data.email, taskType: "Weekly", managerId: data.assignedManager } }
            );
        }

        // 9️⃣ Update totalAssignedCustomer in Task if mainTaskId provided
        if (data.mainTaskId) {
            const task = await SubTask.findById(data.mainTaskId);
            if (task) {
                task.totalAssignedCustomer = (task.totalAssignedCustomer || 0) + 1;
                await task.save();
            }
        }

        // 🔟 Get assigned manager name (if provided)
        let assignedManagerName = "";
        if (data.assignedManager) {
            const manager = await Member.findById(data.assignedManager);
            if (manager) assignedManagerName = manager.memberName;
        }

        // 1️⃣1️⃣ Also update totalAssignedCustomer for first subtask if exists
        if (dailyTaskIds[0] || weeklyTaskIds[0]) {
            const task = await SubTask.findById(dailyTaskIds[0] || weeklyTaskIds[0]);
            if (task) {
                task.totalAssignedCustomer = (task.totalAssignedCustomer || 0) + 1;
                await task.save();
            }
        }

        // 1️⃣2️⃣ Prepare updated member data object
        const updatedMemberData = {
            memberName: data.memberName,
            location: data.location,
            email: data.email,
            password: data.password || member.password, // keep old password if not updated
            role: data.role,
            assignedManager: data.assignedManager || null,
            dailyTitle: data.dailyTitle || "",
            dailyDescription: data.dailyDescription || "",
            weeklyTitle: data.weeklyTitle || "",
            weeklyDescription: data.weeklyDescription || "",
            myDailyTasks: dailyTasks?.map(task => task._id) || "",
            myWeeklyTasks: weeklyTasks?.map(task => task._id) || "",
            mainTaskId: data.mainTaskId || null,
            assignedManagerName: assignedManagerName,
            dailyMainTaskId: dailyTasks[0] || null, // Use first task if exists
            weeklyMainTaskId: weeklyTasks[0] || null, // Use first task if exists
        };

        console.log("Updated Member Data:", weeklyTasks[0]);

        // 1️⃣3️⃣ Update member document and return updated
        const updatedMember = await Member.findByIdAndUpdate(id, updatedMemberData, { new: true, runValidators: true });
        if (!updatedMember) {
            throw new ApiError(404, "Member not found after update");
        }

        return updatedMember;
    } catch (error) {
        throw new ApiError(500, error.message);
    }
};


const login = async (email, password) => {


    // Check if the member exists
    const member = await Member.findOne({ email });
    console.log(member);

    if (member.role == "customer") {
        if (member.userActivity === false) {
            throw new ApiError(400, "You are Block by Admin !");
        }

    }

    if (!member) {
        throw new ApiError(401, "Invalid email or password");
    }

    if (member.password !== password) {
        throw new ApiError(401, "Invalid email or password");
    }

    // const token = jwtToken.sign(
    //     { userId: member._id, email: member.email, type: "access" },
    //     jwt.secret, // Ensure you have a secret key in your .env file
    //     { expiresIn: '30d' } // Token expiration time (can adjust as needed),
    // );

    return member;
};



const updateMembersAsUser = async (id, updateData, file) => {

    try {
        if (!updateData || Object.keys(updateData).length === 0) {
            throw new ApiError(400, "Update data is required");
        }
        // Handle password validation
        if (updateData.password && updateData.password.length < 6) {
            throw new ApiError(400, "Password must be at least 6 characters");
        }

        // Handle file upload (if any)
        if (file) {
            updateData.profileImage = "uploads/members/" + file.filename; // Save the uploaded image path
        }
        // Update the member
        const updatedMember = await Member.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true
        });
        if (!updatedMember) {
            throw new ApiError(404, "Member not found");
        }

        return updatedMember;
    } catch (error) {
        throw new ApiError(500, error.message);
    }
};


const getAllManager = async () => {
    try {
        const members = await Member.find({ role: "manager" });


        // totalAssignedCustomer

        for (const member of members) {
            const tasks = await Member.find({ assignedManager: member._id });
            member.totalAssignedCustomer = tasks.length;
        }

        console.log(members);

        return members;
    } catch (error) {
        throw new ApiError(500, error.message);
    }
};

module.exports = {
    createMember,
    getSingleMember,
    getAllMembers,
    updateMember,
    login,
    updateMembersAsUser,
    getAllManager,
    getAllCustomer
};
