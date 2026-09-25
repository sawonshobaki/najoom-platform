import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { UserRole } from "@/generated/prisma/client";

const {
  hashPasswordMock,
  userFindUniqueMock,
  userCreateMock,
  userUpdateMock,
  studentFindUniqueMock,
  studentFindUniqueOrThrowMock,
  studentFindManyMock,
  studentCountMock,
  studentCreateMock,
  studentUpdateMock,
  sectionFindUniqueMock,
  sessionUpdateManyMock,
  transactionMock,
} = vi.hoisted(() => ({
  hashPasswordMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userCreateMock: vi.fn(),
  userUpdateMock: vi.fn(),
  studentFindUniqueMock: vi.fn(),
  studentFindUniqueOrThrowMock: vi.fn(),
  studentFindManyMock: vi.fn(),
  studentCountMock: vi.fn(),
  studentCreateMock: vi.fn(),
  studentUpdateMock: vi.fn(),
  sectionFindUniqueMock: vi.fn(),
  sessionUpdateManyMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
    student: {
      findUnique: studentFindUniqueMock,
      findUniqueOrThrow:
        studentFindUniqueOrThrowMock,
      findMany: studentFindManyMock,
      count: studentCountMock,
      update: studentUpdateMock,
    },
    section: {
      findUnique: sectionFindUniqueMock,
    },
    $transaction: transactionMock,
  },
}));

import {
  StudentServiceError,
  activateStudent,
  addStudentToSection,
  createStudent,
  deactivateStudent,
  listStudents,
  removeStudentFromSection,
  setStudentActiveState,
} from "@/lib/students/student-service";

describe("student service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    hashPasswordMock.mockResolvedValue(
      "hashed-password",
    );

    studentFindManyMock.mockResolvedValue([]);
    studentCountMock.mockResolvedValue(0);

    transactionMock.mockImplementation(
      async (callback) =>
        callback({
          user: {
            create: userCreateMock,
            update: userUpdateMock,
          },
          student: {
            create: studentCreateMock,
            update: studentUpdateMock,
          },
          session: {
            updateMany: sessionUpdateManyMock,
          },
        }),
    );
  });

  it("creates a student and user in one transaction", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    studentFindUniqueMock.mockResolvedValue(null);

    userCreateMock.mockResolvedValue({
      id: "user-1",
      username: "student-001",
    });

    studentCreateMock.mockResolvedValue({
      id: "student-1",
      studentCode: "ST-0001",
      fullName: "طالبة تجريبية",
      currentSectionId: null,
      isActive: true,
      user: {
        id: "user-1",
        username: "student-001",
        role: UserRole.STUDENT,
        isActive: true,
      },
    });

    const result = await createStudent({
      username: "  student-001  ",
      password: "ValidPassword2026",
      studentCode: " st-0001 ",
      fullName: "  طالبة تجريبية  ",
    });

    expect(
      hashPasswordMock,
    ).toHaveBeenCalledWith(
      "ValidPassword2026",
    );

    expect(
      transactionMock,
    ).toHaveBeenCalledOnce();

    expect(
      userCreateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          username: "student-001",
          passwordHash:
            "hashed-password",
          role: UserRole.STUDENT,
          isActive: true,
        },
      }),
    );

    expect(
      studentCreateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: "user-1",
          studentCode: "ST-0001",
          fullName:
            "طالبة تجريبية",
          currentSectionId: null,
          isActive: true,
        },
      }),
    );

    expect(result.id).toBe(
      "student-1",
    );
  });

  it("creates a student in an active section", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      id: "section-1",
      isActive: true,
    });

    userFindUniqueMock.mockResolvedValue(null);
    studentFindUniqueMock.mockResolvedValue(null);

    userCreateMock.mockResolvedValue({
      id: "user-1",
      username: "student-001",
    });

    studentCreateMock.mockResolvedValue({
      id: "student-1",
      studentCode: "ST-0001",
      fullName: "طالبة تجريبية",
      currentSectionId: "section-1",
      isActive: true,
      user: {
        id: "user-1",
        username: "student-001",
        role: UserRole.STUDENT,
        isActive: true,
      },
    });

    await createStudent({
      username: "student-001",
      password: "ValidPassword2026",
      studentCode: "ST-0001",
      fullName: "طالبة تجريبية",
      sectionId: "section-1",
    });

    expect(
      sectionFindUniqueMock,
    ).toHaveBeenCalledWith({
      where: {
        id: "section-1",
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    expect(
      studentCreateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentSectionId:
            "section-1",
        }),
      }),
    );
  });

  it("rejects creating a student in an inactive section", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      id: "section-1",
      isActive: false,
    });

    await expect(
      createStudent({
        username: "student-001",
        password:
          "ValidPassword2026",
        studentCode: "ST-0001",
        fullName: "طالبة تجريبية",
        sectionId: "section-1",
      }),
    ).rejects.toMatchObject({
      code: "section_inactive",
    });

    expect(
      transactionMock,
    ).not.toHaveBeenCalled();
  });

  it("rejects duplicate usernames during the early check", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "existing-user",
    });

    studentFindUniqueMock.mockResolvedValue(null);

    await expect(
      createStudent({
        username: "student-001",
        password:
          "ValidPassword2026",
        studentCode: "ST-0001",
        fullName: "طالبة تجريبية",
      }),
    ).rejects.toMatchObject({
      code: "username_already_exists",
    });

    expect(
      transactionMock,
    ).not.toHaveBeenCalled();
  });

  it("rejects duplicate student codes during the early check", async () => {
    userFindUniqueMock.mockResolvedValue(null);

    studentFindUniqueMock.mockResolvedValue({
      id: "existing-student",
    });

    await expect(
      createStudent({
        username: "student-001",
        password:
          "ValidPassword2026",
        studentCode: "ST-0001",
        fullName: "طالبة تجريبية",
      }),
    ).rejects.toMatchObject({
      code:
        "student_code_already_exists",
    });

    expect(
      transactionMock,
    ).not.toHaveBeenCalled();
  });

  it("maps a concurrent username unique conflict to a service error", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    studentFindUniqueMock.mockResolvedValue(null);

    userCreateMock.mockRejectedValue({
      code: "P2002",
    });

    await expect(
      createStudent({
        username: "student-001",
        password:
          "ValidPassword2026",
        studentCode: "ST-0001",
        fullName: "طالبة تجريبية",
      }),
    ).rejects.toMatchObject({
      code: "username_already_exists",
    });

    expect(
      transactionMock,
    ).toHaveBeenCalledOnce();

    expect(
      studentCreateMock,
    ).not.toHaveBeenCalled();
  });

  it("maps a concurrent student code unique conflict to a service error", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    studentFindUniqueMock.mockResolvedValue(null);

    userCreateMock.mockResolvedValue({
      id: "user-1",
      username: "student-001",
    });

    studentCreateMock.mockRejectedValue({
      code: "P2002",
    });

    await expect(
      createStudent({
        username: "student-001",
        password:
          "ValidPassword2026",
        studentCode: "ST-0001",
        fullName: "طالبة تجريبية",
      }),
    ).rejects.toMatchObject({
      code:
        "student_code_already_exists",
    });

    expect(
      transactionMock,
    ).toHaveBeenCalledOnce();

    expect(
      userCreateMock,
    ).toHaveBeenCalledOnce();

    expect(
      studentCreateMock,
    ).toHaveBeenCalledOnce();
  });

  it("does not hide unexpected database errors during user creation", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    studentFindUniqueMock.mockResolvedValue(null);

    const databaseError = new Error(
      "unexpected database error",
    );

    userCreateMock.mockRejectedValue(
      databaseError,
    );

    await expect(
      createStudent({
        username: "student-001",
        password:
          "ValidPassword2026",
        studentCode: "ST-0001",
        fullName: "طالبة تجريبية",
      }),
    ).rejects.toBe(databaseError);
  });

  it("does not hide unexpected database errors during student creation", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    studentFindUniqueMock.mockResolvedValue(null);

    userCreateMock.mockResolvedValue({
      id: "user-1",
      username: "student-001",
    });

    const databaseError = new Error(
      "unexpected database error",
    );

    studentCreateMock.mockRejectedValue(
      databaseError,
    );

    await expect(
      createStudent({
        username: "student-001",
        password:
          "ValidPassword2026",
        studentCode: "ST-0001",
        fullName: "طالبة تجريبية",
      }),
    ).rejects.toBe(databaseError);
  });

  it("adds an unassigned active student to an active section", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      id: "section-2",
      isActive: true,
    });

    studentFindUniqueMock.mockResolvedValue({
      id: "student-1",
      isActive: true,
      currentSectionId: null,
    });

    studentUpdateMock.mockResolvedValue({
      id: "student-1",
      studentCode: "ST-0001",
      fullName: "طالبة تجريبية",
      currentSectionId: "section-2",
      isActive: true,
    });

    const result =
      await addStudentToSection(
        "student-1",
        "section-2",
      );

    expect(
      studentUpdateMock,
    ).toHaveBeenCalledWith({
      where: {
        id: "student-1",
      },
      data: {
        currentSectionId:
          "section-2",
      },
      select: {
        id: true,
        studentCode: true,
        fullName: true,
        currentSectionId: true,
        isActive: true,
      },
    });

    expect(
      result.currentSectionId,
    ).toBe("section-2");
  });

  it("prevents direct transfer between sections", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      id: "section-2",
      isActive: true,
    });

    studentFindUniqueMock.mockResolvedValue({
      id: "student-1",
      isActive: true,
      currentSectionId: "section-1",
    });

    await expect(
      addStudentToSection(
        "student-1",
        "section-2",
      ),
    ).rejects.toMatchObject({
      code:
        "student_already_in_section",
    });

    expect(
      studentUpdateMock,
    ).not.toHaveBeenCalled();
  });

  it("does not rewrite the student when already in the same section", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      id: "section-1",
      isActive: true,
    });

    studentFindUniqueMock.mockResolvedValue({
      id: "student-1",
      isActive: true,
      currentSectionId: "section-1",
    });

    studentFindUniqueOrThrowMock.mockResolvedValue({
      id: "student-1",
      studentCode: "ST-0001",
      fullName: "طالبة تجريبية",
      currentSectionId: "section-1",
      isActive: true,
    });

    const result =
      await addStudentToSection(
        "student-1",
        "section-1",
      );

    expect(
      studentUpdateMock,
    ).not.toHaveBeenCalled();

    expect(
      studentFindUniqueOrThrowMock,
    ).toHaveBeenCalledOnce();

    expect(
      result.currentSectionId,
    ).toBe("section-1");
  });

  it("rejects adding an inactive student to a section", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      id: "section-1",
      isActive: true,
    });

    studentFindUniqueMock.mockResolvedValue({
      id: "student-1",
      isActive: false,
      currentSectionId: null,
    });

    await expect(
      addStudentToSection(
        "student-1",
        "section-1",
      ),
    ).rejects.toMatchObject({
      code: "student_inactive",
    });

    expect(
      studentUpdateMock,
    ).not.toHaveBeenCalled();
  });

  it("removes a student from the current section without deleting the student", async () => {
    studentFindUniqueMock.mockResolvedValue({
      id: "student-1",
      currentSectionId: "section-1",
    });

    studentUpdateMock.mockResolvedValue({
      id: "student-1",
      studentCode: "ST-0001",
      fullName: "طالبة تجريبية",
      currentSectionId: null,
      isActive: true,
    });

    const result =
      await removeStudentFromSection(
        "student-1",
      );

    expect(
      studentUpdateMock,
    ).toHaveBeenCalledWith({
      where: {
        id: "student-1",
      },
      data: {
        currentSectionId: null,
      },
      select: {
        id: true,
        studentCode: true,
        fullName: true,
        currentSectionId: true,
        isActive: true,
      },
    });

    expect(
      result.currentSectionId,
    ).toBeNull();
  });

  it("does not rewrite a student who is already unassigned", async () => {
    studentFindUniqueMock.mockResolvedValue({
      id: "student-1",
      currentSectionId: null,
    });

    studentFindUniqueOrThrowMock.mockResolvedValue({
      id: "student-1",
      studentCode: "ST-0001",
      fullName: "طالبة تجريبية",
      currentSectionId: null,
      isActive: true,
    });

    await removeStudentFromSection(
      "student-1",
    );

    expect(
      studentUpdateMock,
    ).not.toHaveBeenCalled();

    expect(
      studentFindUniqueOrThrowMock,
    ).toHaveBeenCalledOnce();
  });

  it("throws a typed error when the student does not exist", async () => {
    studentFindUniqueMock.mockResolvedValue(null);

    await expect(
      removeStudentFromSection(
        "missing-student",
      ),
    ).rejects.toBeInstanceOf(
      StudentServiceError,
    );
  });

  it("deactivates the student and user in one transaction", async () => {
    studentFindUniqueMock.mockResolvedValue({
      id: "student-1",
      userId: "user-1",
      isActive: true,
      user: {
        isActive: true,
      },
    });

    userUpdateMock.mockResolvedValue({
      id: "user-1",
      isActive: false,
    });

    studentUpdateMock.mockResolvedValue({
      id: "student-1",
      studentCode: "ST-0001",
      fullName: "طالبة تجريبية",
      currentSectionId: "section-1",
      isActive: false,
      user: {
        id: "user-1",
        username: "student-001",
        role: UserRole.STUDENT,
        isActive: false,
      },
    });

    sessionUpdateManyMock.mockResolvedValue({
      count: 2,
    });

    const result =
      await deactivateStudent(
        "student-1",
      );

    expect(
      transactionMock,
    ).toHaveBeenCalledOnce();

    expect(
      userUpdateMock,
    ).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        isActive: false,
      },
    });

    expect(
      studentUpdateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "student-1",
        },
        data: {
          isActive: false,
        },
      }),
    );

    expect(
      sessionUpdateManyMock,
    ).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        revokedAt: null,
      },
      data: {
        revokedAt:
          expect.any(Date),
        revokeReason:
          "student_deactivated",
      },
    });

    expect(result.isActive).toBe(
      false,
    );
  });

  it("activates the student and user without restoring old sessions", async () => {
    studentFindUniqueMock.mockResolvedValue({
      id: "student-1",
      userId: "user-1",
      isActive: false,
      user: {
        isActive: false,
      },
    });

    userUpdateMock.mockResolvedValue({
      id: "user-1",
      isActive: true,
    });

    studentUpdateMock.mockResolvedValue({
      id: "student-1",
      studentCode: "ST-0001",
      fullName: "طالبة تجريبية",
      currentSectionId: "section-1",
      isActive: true,
      user: {
        id: "user-1",
        username: "student-001",
        role: UserRole.STUDENT,
        isActive: true,
      },
    });

    const result =
      await activateStudent(
        "student-1",
      );

    expect(
      userUpdateMock,
    ).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        isActive: true,
      },
    });

    expect(
      studentUpdateMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          isActive: true,
        },
      }),
    );

    expect(
      sessionUpdateManyMock,
    ).not.toHaveBeenCalled();

    expect(result.isActive).toBe(
      true,
    );
  });

  it("does not open a transaction when the active state already matches", async () => {
    studentFindUniqueMock.mockResolvedValue({
      id: "student-1",
      userId: "user-1",
      isActive: true,
      user: {
        isActive: true,
      },
    });

    studentFindUniqueOrThrowMock.mockResolvedValue({
      id: "student-1",
      studentCode: "ST-0001",
      fullName: "طالبة تجريبية",
      currentSectionId: "section-1",
      isActive: true,
      user: {
        id: "user-1",
        username: "student-001",
        role: UserRole.STUDENT,
        isActive: true,
      },
    });

    const result =
      await setStudentActiveState(
        "student-1",
        true,
      );

    expect(
      transactionMock,
    ).not.toHaveBeenCalled();

    expect(
      studentFindUniqueOrThrowMock,
    ).toHaveBeenCalledOnce();

    expect(result.isActive).toBe(
      true,
    );
  });

  it("throws when changing active state for a missing student", async () => {
    studentFindUniqueMock.mockResolvedValue(null);

    await expect(
      setStudentActiveState(
        "missing-student",
        false,
      ),
    ).rejects.toMatchObject({
      code: "student_not_found",
    });

    expect(
      transactionMock,
    ).not.toHaveBeenCalled();
  });

  it("lists students with default pagination", async () => {
    studentFindManyMock.mockResolvedValue([
      {
        id: "student-1",
        studentCode: "ST-0001",
        fullName: "طالبة تجريبية",
        isActive: true,
        currentSectionId: "section-1",
        user: {
          id: "user-1",
          username: "student-001",
          isActive: true,
        },
        currentSection: {
          id: "section-1",
          name: "أ",
          isActive: true,
          grade: {
            id: "grade-5",
            name: "الصف الخامس",
            sortOrder: 5,
          },
        },
      },
    ]);

    studentCountMock.mockResolvedValue(1);

    const result = await listStudents();

    expect(
      studentFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 25,
      }),
    );

    expect(
      studentCountMock,
    ).toHaveBeenCalledWith({
      where: {},
    });

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 25,
      totalCount: 1,
      totalPages: 1,
    });

    expect(result.students).toHaveLength(1);
  });

  it("applies grade filter", async () => {
    await listStudents({
      gradeId: " grade-5 ",
    });

    expect(
      studentFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          currentSection: {
            is: {
              gradeId: "grade-5",
            },
          },
        },
      }),
    );

    expect(
      studentCountMock,
    ).toHaveBeenCalledWith({
      where: {
        currentSection: {
          is: {
            gradeId: "grade-5",
          },
        },
      },
    });
  });

  it("applies section and active state filters", async () => {
    await listStudents({
      sectionId: " section-1 ",
      isActive: false,
    });

    expect(
      studentFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: false,
          currentSectionId:
            "section-1",
        },
      }),
    );
  });

  it("lists students without a section when sectionId is null", async () => {
    await listStudents({
      sectionId: null,
    });

    expect(
      studentFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          currentSectionId: null,
        },
      }),
    );
  });

  it("searches by name, student code, or username", async () => {
    await listStudents({
      search: "  نجوم  ",
    });

    expect(
      studentFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              fullName: {
                contains: "نجوم",
                mode: "insensitive",
              },
            },
            {
              studentCode: {
                contains: "نجوم",
                mode: "insensitive",
              },
            },
            {
              user: {
                username: {
                  contains: "نجوم",
                  mode: "insensitive",
                },
              },
            },
          ],
        },
      }),
    );
  });

  it("uses requested pagination values", async () => {
    studentCountMock.mockResolvedValue(51);

    const result = await listStudents({
      page: 3,
      pageSize: 20,
    });

    expect(
      studentFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 20,
      }),
    );

    expect(result.pagination).toEqual({
      page: 3,
      pageSize: 20,
      totalCount: 51,
      totalPages: 3,
    });
  });

  it("returns zero total pages when there are no students", async () => {
    studentFindManyMock.mockResolvedValue([]);
    studentCountMock.mockResolvedValue(0);

    const result = await listStudents();

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 25,
      totalCount: 0,
      totalPages: 0,
    });

    expect(result.students).toEqual([]);
  });

  it("rejects invalid pagination", async () => {
    await expect(
      listStudents({
        page: 0,
      }),
    ).rejects.toMatchObject({
      code:
        "invalid_student_list_query",
    });

    await expect(
      listStudents({
        pageSize: 101,
      }),
    ).rejects.toMatchObject({
      code:
        "invalid_student_list_query",
    });

    expect(
      studentFindManyMock,
    ).not.toHaveBeenCalled();

    expect(
      studentCountMock,
    ).not.toHaveBeenCalled();
  });

  it("rejects invalid empty grade or section filters", async () => {
    await expect(
      listStudents({
        gradeId: "   ",
      }),
    ).rejects.toMatchObject({
      code:
        "invalid_student_list_query",
    });

    await expect(
      listStudents({
        sectionId: "   ",
      }),
    ).rejects.toMatchObject({
      code:
        "invalid_student_list_query",
    });
  });

  it("rejects an excessively long search query", async () => {
    await expect(
      listStudents({
        search: "a".repeat(101),
      }),
    ).rejects.toMatchObject({
      code:
        "invalid_student_list_query",
    });
  });
});