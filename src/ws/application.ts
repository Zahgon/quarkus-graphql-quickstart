/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/**
 * The base URI for the RESTful web services.
 *
 * The original declares it with `@ApplicationPath("/api")` on a
 * `jakarta.ws.rs.core.Application` subclass; the class carries no other state
 * and exists solely to hold that annotation.
 *
 * @see https://jakarta.ee/specifications/restful-ws/3.1/jakarta-restful-ws-spec-3.1.html#application
 * @author Antonio Musarra
 */
export const APPLICATION_PATH = '/api';
