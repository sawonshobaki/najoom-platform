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
  studentUpdateManyMock,
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
  studentUpdateManyMock: vi.fn(),
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
      findUniqueOrThrow: studentFindUniqueOrThrowMock,
      findMany: studentFindManyMock,
      count: studentCountMock,
      update: studentUpdateMock,
      updateMany: studentUpdateManyMock,
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

const studentInput = {
  username: "student-001",
  password: "ValidPassword2026",
  studentCode: "ST-0001",
  fullName: "طالبة تجريبية",
};

const unassignedStudent = {
  id: "student-1",
  studentCode: "ST-0001",
  fullName: "طالبة تجريبية",
  currentSectionId: null,
  isActive: true,
};

const studentUser = {
  id: "user-1",
  username: "student-001",
  role: UserRole.STUDENT,
  isActive: true,
};

function mockActiveSection(
  id = "section-1",
) {
  sectionFindUniqueMock.mockResolvedValue({
    id,
    isActive: true,
  });
}

function mockUnassignedStudent() {
  studentFindUniqueMock.mockResolvedValue({
    id: "student-1",
    isActive: true,
    currentSectionId: null,
  });
}

describe("student service", () => {
  beforeEach(() => {
    // مهم: إعادة ضبط التنفيذ وسجل الاستدعاءات معًا.
    vi.resetAllMocks();

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

  describe("createStudent", () => {
    beforeEach(() => {
      userFindUniqueMock.mockResolvedValue(null);
      studentFindUniqueMock.mockResolvedValue(null);

      userCreateMock.mockResolvedValue({
        id: "user-1",
        username: "student-001",
      });

      studentCreateMock.mockResolvedValue({
        ...unassignedStudent,
        user: studentUser,
      });
    });

    it("creates a student and user in one transaction", async () => {
      const result = await createStudent({
        ...studentInput,
        username: "  student-001  ",
        studentCode: " st-0001 ",
        fullName: "  طالبة تجريبية  ",
      });

      expect(hashPasswordMock).toHaveBeenCalledWith(
        "ValidPassword2026",
      );

      expect(transactionMock).toHaveBeenCalledOnce();

      expect(userCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            username: "student-001",
            passwordHash: "hashed-password",
            role: UserRole.STUDENT,
            isActive: true,
          },
        }),
      );

      expect(studentCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: "user-1",
            studentCode: "ST-0001",
            fullName: "طالبة تجريبية",
            currentSectionId: null,
            isActive: true,
          },
        }),
      );

      expect(result.id).toBe("student-1");
    });

    it("creates a student in an active section", async () => {
      mockActiveSection();

      await createStudent({
        ...studentInput,
        sectionId: "section-1",
      });

      expect(sectionFindUniqueMock)
        .toHaveBeenCalledWith({
          where: {
            id: "section-1",
          },
          select: {
            id: true,
            isActive: true,
          },
        });

      expect(studentCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentSectionId: "section-1",
          }),
        }),
      );
    });

    it("rejects an inactive section", async () => {
      sectionFindUniqueMock.mockResolvedValue({
        id: "section-1",
        isActive: false,
      });

      await expect(
        createStudent({
          ...studentInput,
          sectionId: "section-1",
        }),
      ).rejects.toMatchObject({
        code: "section_inactive",
      });

      expect(transactionMock)
        .not.toHaveBeenCalled();
    });

    it("rejects a missing section", async () => {
      sectionFindUniqueMock.mockResolvedValue(
        null,
      );

      await expect(
        createStudent({
          ...studentInput,
          sectionId: "missing-section",
        }),
      ).rejects.toMatchObject({
        code: "section_not_found",
      });
    });

    it("rejects duplicate usernames", async () => {
      userFindUniqueMock.mockResolvedValue({
        id: "existing-user",
      });

      await expect(
        createStudent(studentInput),
      ).rejects.toMatchObject({
        code: "username_already_exists",
      });

      expect(transactionMock)
        .not.toHaveBeenCalled();
    });

    it("rejects duplicate student codes", async () => {
      studentFindUniqueMock.mockResolvedValue({
        id: "existing-student",
      });

      await expect(
        createStudent(studentInput),
      ).rejects.toMatchObject({
        code: "student_code_already_exists",
      });

      expect(transactionMock)
        .not.toHaveBeenCalled();
    });

    it("handles concurrent username conflicts", async () => {
      userCreateMock.mockRejectedValue({
        code: "P2002",
      });

      await expect(
        createStudent(studentInput),
      ).rejects.toMatchObject({
        code: "username_already_exists",
      });

      expect(studentCreateMock)
        .not.toHaveBeenCalled();
    });

    it("handles concurrent student code conflicts", async () => {
      studentCreateMock.mockRejectedValue({
        code: "P2002",
      });

      await expect(
        createStudent(studentInput),
      ).rejects.toMatchObject({
        code: "student_code_already_exists",
      });

      expect(userCreateMock).toHaveBeenCalledOnce();
      expect(studentCreateMock)
        .toHaveBeenCalledOnce();
    });

    it("does not hide unexpected user creation errors", async () => {
      const error = new Error(
        "Unexpected user database error",
      );

      userCreateMock.mockRejectedValue(error);

      await expect(
        createStudent(studentInput),
      ).rejects.toBe(error);
    });

    it("does not hide unexpected student creation errors", async () => {
      const error = new Error(
        "Unexpected student database error",
      );

      studentCreateMock.mockRejectedValue(error);

      await expect(
        createStudent(studentInput),
      ).rejects.toBe(error);
    });

    it.each([
      [
        "invalid_username",
        { username: " " },
      ],
      [
        "invalid_student_code",
        { studentCode: " " },
      ],
      [
        "invalid_full_name",
        { fullName: " " },
      ],
    ])(
      "rejects %s",
      async (code, changes) => {
        await expect(
          createStudent({
            ...studentInput,
            ...changes,
          }),
        ).rejects.toMatchObject({
          code,
        });

        expect(transactionMock)
          .not.toHaveBeenCalled();
      },
    );
  });

  describe("addStudentToSection", () => {
    beforeEach(() => {
      mockActiveSection("section-2");
      mockUnassignedStudent();

      studentUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      studentFindUniqueOrThrowMock.mockResolvedValue({
        ...unassignedStudent,
        currentSectionId: "section-2",
      });
    });

    it("atomically assigns an unassigned student", async () => {
      const result = await addStudentToSection(
        "student-1",
        "section-2",
      );

      expect(studentUpdateManyMock)
        .toHaveBeenCalledWith({
          where: {
            id: "student-1",
            isActive: true,
            currentSectionId: null,
          },
          data: {
            currentSectionId: "section-2",
          },
        });

      expect(studentUpdateMock)
        .not.toHaveBeenCalled();

      expect(result.currentSectionId)
        .toBe("section-2");
    });

    it("prevents direct transfers", async () => {
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
        code: "student_already_in_section",
      });

      expect(studentUpdateManyMock)
        .not.toHaveBeenCalled();
    });

    it("does not rewrite an existing assignment to the same section", async () => {
      studentFindUniqueMock.mockResolvedValue({
        id: "student-1",
        isActive: true,
        currentSectionId: "section-2",
      });

      const result = await addStudentToSection(
        "student-1",
        "section-2",
      );

      expect(studentUpdateManyMock)
        .not.toHaveBeenCalled();

      expect(result.currentSectionId)
        .toBe("section-2");
    });

    it("rejects an inactive student", async () => {
      studentFindUniqueMock.mockResolvedValue({
        id: "student-1",
        isActive: false,
        currentSectionId: null,
      });

      await expect(
        addStudentToSection(
          "student-1",
          "section-2",
        ),
      ).rejects.toMatchObject({
        code: "student_inactive",
      });

      expect(studentUpdateManyMock)
        .not.toHaveBeenCalled();
    });

    it("rejects a missing student", async () => {
      studentFindUniqueMock.mockResolvedValue(
        null,
      );

      await expect(
        addStudentToSection(
          "missing-student",
          "section-2",
        ),
      ).rejects.toMatchObject({
        code: "student_not_found",
      });
    });

    it("treats concurrent assignment to the same section as success", async () => {
      studentFindUniqueMock
        .mockResolvedValueOnce({
          id: "student-1",
          isActive: true,
          currentSectionId: null,
        })
        .mockResolvedValueOnce({
          id: "student-1",
          isActive: true,
          currentSectionId: "section-2",
        });

      studentUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      const result = await addStudentToSection(
        "student-1",
        "section-2",
      );

      expect(result.currentSectionId)
        .toBe("section-2");
    });

    it("prevents a concurrent direct transfer", async () => {
      studentFindUniqueMock
        .mockResolvedValueOnce({
          id: "student-1",
          isActive: true,
          currentSectionId: null,
        })
        .mockResolvedValueOnce({
          id: "student-1",
          isActive: true,
          currentSectionId: "section-3",
        });

      studentUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(
        addStudentToSection(
          "student-1",
          "section-2",
        ),
      ).rejects.toMatchObject({
        code: "student_already_in_section",
      });
    });

    it("detects concurrent deactivation", async () => {
      studentFindUniqueMock
        .mockResolvedValueOnce({
          id: "student-1",
          isActive: true,
          currentSectionId: null,
        })
        .mockResolvedValueOnce({
          id: "student-1",
          isActive: false,
          currentSectionId: null,
        });

      studentUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(
        addStudentToSection(
          "student-1",
          "section-2",
        ),
      ).rejects.toMatchObject({
        code: "student_inactive",
      });
    });

    it("detects concurrent deletion", async () => {
      studentFindUniqueMock
        .mockResolvedValueOnce({
          id: "student-1",
          isActive: true,
          currentSectionId: null,
        })
        .mockResolvedValueOnce(null);

      studentUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(
        addStudentToSection(
          "student-1",
          "section-2",
        ),
      ).rejects.toMatchObject({
        code: "student_not_found",
      });
    });

    it("does not hide unexplained assignment failure", async () => {
      studentFindUniqueMock
        .mockResolvedValueOnce({
          id: "student-1",
          isActive: true,
          currentSectionId: null,
        })
        .mockResolvedValueOnce({
          id: "student-1",
          isActive: true,
          currentSectionId: null,
        });

      studentUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(
        addStudentToSection(
          "student-1",
          "section-2",
        ),
      ).rejects.toThrow(
        "Student section assignment failed unexpectedly.",
      );
    });
  });

  describe("removeStudentFromSection", () => {
    beforeEach(() => {
      studentFindUniqueMock.mockResolvedValue({
        id: "student-1",
        currentSectionId: "section-1",
      });

      studentUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      studentFindUniqueOrThrowMock.mockResolvedValue(
        unassignedStudent,
      );
    });

    it("atomically removes the original assignment", async () => {
      const result =
        await removeStudentFromSection(
          "student-1",
        );

      expect(studentUpdateManyMock)
        .toHaveBeenCalledWith({
          where: {
            id: "student-1",
            currentSectionId: "section-1",
          },
          data: {
            currentSectionId: null,
          },
        });

      expect(studentUpdateMock)
        .not.toHaveBeenCalled();

      expect(result.currentSectionId)
        .toBeNull();
    });

    it("does not rewrite an unassigned student", async () => {
      studentFindUniqueMock.mockResolvedValue({
        id: "student-1",
        currentSectionId: null,
      });

      const result =
        await removeStudentFromSection(
          "student-1",
        );

      expect(studentUpdateManyMock)
        .not.toHaveBeenCalled();

      expect(result.currentSectionId)
        .toBeNull();
    });

    it("rejects a missing student", async () => {
      studentFindUniqueMock.mockResolvedValue(
        null,
      );

      await expect(
        removeStudentFromSection(
          "missing-student",
        ),
      ).rejects.toBeInstanceOf(
        StudentServiceError,
      );

      expect(studentUpdateManyMock)
        .not.toHaveBeenCalled();
    });

    it("treats a concurrent removal as success", async () => {
      studentFindUniqueMock
        .mockResolvedValueOnce({
          id: "student-1",
          currentSectionId: "section-1",
        })
        .mockResolvedValueOnce({
          id: "student-1",
          currentSectionId: null,
        });

      studentUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      const result =
        await removeStudentFromSection(
          "student-1",
        );

      expect(studentUpdateManyMock)
        .toHaveBeenCalledOnce();

      expect(result.currentSectionId)
        .toBeNull();
    });

    it("preserves a concurrently assigned new section", async () => {
      studentFindUniqueMock
        .mockResolvedValueOnce({
          id: "student-1",
          currentSectionId: "section-1",
        })
        .mockResolvedValueOnce({
          id: "student-1",
          currentSectionId: "section-2",
        });

      studentUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(
        removeStudentFromSection(
          "student-1",
        ),
      ).rejects.toMatchObject({
        code: "student_section_changed",
      });

      expect(studentUpdateManyMock)
        .toHaveBeenCalledWith({
          where: {
            id: "student-1",
            currentSectionId: "section-1",
          },
          data: {
            currentSectionId: null,
          },
        });

      expect(studentUpdateMock)
        .not.toHaveBeenCalled();

      expect(studentFindUniqueOrThrowMock)
        .not.toHaveBeenCalled();
    });

    it("detects concurrent deletion", async () => {
      studentFindUniqueMock
        .mockResolvedValueOnce({
          id: "student-1",
          currentSectionId: "section-1",
        })
        .mockResolvedValueOnce(null);

      studentUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(
        removeStudentFromSection(
          "student-1",
        ),
      ).rejects.toMatchObject({
        code: "student_not_found",
      });
    });

    it("does not hide an unexplained removal failure", async () => {
      studentFindUniqueMock
        .mockResolvedValueOnce({
          id: "student-1",
          currentSectionId: "section-1",
        })
        .mockResolvedValueOnce({
          id: "student-1",
          currentSectionId: "section-1",
        });

      studentUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(
        removeStudentFromSection(
          "student-1",
        ),
      ).rejects.toThrow(
        "Student section removal failed unexpectedly.",
      );
    });
  });

  describe("student active state", () => {
    const activeStudent = {
      id: "student-1",
      userId: "user-1",
      isActive: true,
      user: {
        isActive: true,
      },
    };

    const inactiveStudent = {
      ...activeStudent,
      isActive: false,
      user: {
        isActive: false,
      },
    };

    it("deactivates student and user in one transaction", async () => {
      studentFindUniqueMock.mockResolvedValue(
        activeStudent,
      );

      studentUpdateMock.mockResolvedValue({
        ...unassignedStudent,
        isActive: false,
        user: {
          ...studentUser,
          isActive: false,
        },
      });

      sessionUpdateManyMock.mockResolvedValue({
        count: 2,
      });

      const result = await deactivateStudent(
        "student-1",
      );

      expect(transactionMock)
        .toHaveBeenCalledOnce();

      expect(userUpdateMock)
        .toHaveBeenCalledWith({
          where: {
            id: "user-1",
          },
          data: {
            isActive: false,
          },
        });

      expect(studentUpdateMock)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: "student-1",
            },
            data: {
              isActive: false,
            },
          }),
        );

      expect(sessionUpdateManyMock)
        .toHaveBeenCalledWith({
          where: {
            userId: "user-1",
            revokedAt: null,
          },
          data: {
            revokedAt: expect.any(Date),
            revokeReason: "student_deactivated",
          },
        });

      expect(result.isActive).toBe(false);
    });

    it("activates without restoring old sessions", async () => {
      studentFindUniqueMock.mockResolvedValue(
        inactiveStudent,
      );

      studentUpdateMock.mockResolvedValue({
        ...unassignedStudent,
        user: studentUser,
      });

      const result = await activateStudent(
        "student-1",
      );

      expect(userUpdateMock)
        .toHaveBeenCalledWith({
          where: {
            id: "user-1",
          },
          data: {
            isActive: true,
          },
        });

      expect(studentUpdateMock)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              isActive: true,
            },
          }),
        );

      expect(sessionUpdateManyMock)
        .not.toHaveBeenCalled();

      expect(result.isActive).toBe(true);
    });

    it("avoids unnecessary transactions", async () => {
      studentFindUniqueMock.mockResolvedValue(
        activeStudent,
      );

      studentFindUniqueOrThrowMock.mockResolvedValue({
        ...unassignedStudent,
        user: studentUser,
      });

      const result = await setStudentActiveState(
        "student-1",
        true,
      );

      expect(transactionMock)
        .not.toHaveBeenCalled();

      expect(studentFindUniqueOrThrowMock)
        .toHaveBeenCalledOnce();

      expect(result.isActive).toBe(true);
    });

    it("rejects a missing student", async () => {
      studentFindUniqueMock.mockResolvedValue(
        null,
      );

      await expect(
        setStudentActiveState(
          "missing-student",
          false,
        ),
      ).rejects.toMatchObject({
        code: "student_not_found",
      });

      expect(transactionMock)
        .not.toHaveBeenCalled();
    });
  });

  describe("listStudents", () => {
    it("lists students with default pagination", async () => {
      studentFindManyMock.mockResolvedValue([
        {
          ...unassignedStudent,
          currentSectionId: "section-1",
          user: studentUser,
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

      expect(studentFindManyMock)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            where: {},
            skip: 0,
            take: 25,
          }),
        );

      expect(studentCountMock)
        .toHaveBeenCalledWith({
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

    it("applies the grade filter", async () => {
      await listStudents({
        gradeId: " grade-5 ",
      });

      const where = {
        currentSection: {
          is: {
            gradeId: "grade-5",
          },
        },
      };

      expect(studentFindManyMock)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            where,
          }),
        );

      expect(studentCountMock)
        .toHaveBeenCalledWith({
          where,
        });
    });

    it("applies section and active-state filters", async () => {
      await listStudents({
        sectionId: " section-1 ",
        isActive: false,
      });

      expect(studentFindManyMock)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              isActive: false,
              currentSectionId: "section-1",
            },
          }),
        );
    });

    it("lists students without a section", async () => {
      await listStudents({
        sectionId: null,
      });

      expect(studentFindManyMock)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              currentSectionId: null,
            },
          }),
        );
    });

    it("searches by name, code, or username", async () => {
      await listStudents({
        search: "  نجوم  ",
      });

      expect(studentFindManyMock)
        .toHaveBeenCalledWith(
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

      expect(studentFindManyMock)
        .toHaveBeenCalledWith(
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

    it("returns zero pages for an empty list", async () => {
      const result = await listStudents();

      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 25,
        totalCount: 0,
        totalPages: 0,
      });

      expect(result.students).toEqual([]);
    });

    it.each([
      { page: 0 },
      { pageSize: 101 },
      { page: 1.5 },
      { pageSize: 0 },
      { gradeId: "   " },
      { sectionId: "   " },
      { search: "a".repeat(101) },
    ])(
      "rejects an invalid listing query: %j",
      async (input) => {
        await expect(
          listStudents(input),
        ).rejects.toMatchObject({
          code: "invalid_student_list_query",
        });

        expect(studentFindManyMock)
          .not.toHaveBeenCalled();

        expect(studentCountMock)
          .not.toHaveBeenCalled();
      },
    );
  });
});