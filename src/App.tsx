import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserWarning } from './UserWarning';
import { createTodo, getTodos, updateTodos, USER_ID } from './api/todos';
import { Todo } from './types/Todo';
import { client } from './utils/fetchClient';
import classNames from 'classnames';

const FILTERS = {
  all: 'all' as const,
  active: 'active' as const,
  completed: 'completed' as const,
};

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [titleToSet, setTitleToSet] = useState('');
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const [loadingTodoId, setLoadingTodoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[keyof typeof FILTERS]>(
    FILTERS.all,
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredTodos = useMemo(() => {
    switch (filter) {
      case 'active':
        return todos.filter(t => !t.completed);
      case 'completed':
        return todos.filter(t => t.completed);
      default:
        return todos;
    }
  }, [todos, filter]);

  const remainingCount = useMemo(
    () => todos.filter(t => !t.completed).length,
    [todos],
  );

  const updateTodo = async (id: number, checked?: boolean, title?: string) => {
    setError(null);
    setLoadingTodoId(id);

    try {
      const payload = { id };

      if (checked !== undefined) {
        payload.completed = checked;
      }

      if (title !== undefined) {
        payload.title = title;
      }

      const updated = await updateTodos(payload);

      setTodos(prev =>
        prev.map(todo => (todo.id === updated.id ? updated : todo)),
      );

      setSelectedTodoId(null);
      setTitleToSet(''); // 💡 Оновити тут!
    } catch (err) {
      setError("Can't update todo");
    } finally {
      setLoadingTodoId(null);
    }
  };

  const allCompleted = todos.length > 0 && todos.every(t => t.completed);
  const hasCompletedTodos = todos.some(t => t.completed);

  useEffect(() => {
    let isMounted = true;

    getTodos()
      .then(data => {
        if (isMounted) {
          setTodos(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Unable to load todos');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = setTimeout(() => setError(null), 3000);

    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  useEffect(() => {
    if (selectedTodoId === null) {
      return;
    }

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;

      if (inputRef.current && !inputRef.current.contains(target)) {
        const todo = todos.find(t => t.id === selectedTodoId);

        if (!todo) {
          return;
        }

        if (titleToSet.trim() !== '' && titleToSet !== todo.title) {
          updateTodo(selectedTodoId, undefined, titleToSet);
        }

        setSelectedTodoId(null);
        setTitleToSet('');
      }
    };

    document.addEventListener('click', handleOutsideClick);

    return () => document.removeEventListener('click', handleOutsideClick);
  }, [selectedTodoId, titleToSet, todos]);

  if (!USER_ID) {
    return <UserWarning />;
  }

  const addTodo = async (title: string) => {
    const trimmed = title.trim();

    if (!trimmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const createdTodo = await createTodo({
        title: trimmed,
        userId: USER_ID,
        completed: false,
      });

      setTodos(prev => [...prev, createdTodo]);
      setNewTitle('');
    } catch {
      setError('Can`t create todo');
    } finally {
      setLoading(false);
    }
  };

  const deleteTodo = async (id: number) => {
    try {
      await client.delete(`/todos/${id}`);
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Can`t delete todo');
    }
  };

  const deleteCompletedTodos = async () => {
    const ids = todos.filter(t => t.completed).map(t => t.id);

    if (ids.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await Promise.all(ids.map(id => client.delete(`/todos/${id}`)));
      setTodos(prev => prev.filter(t => !t.completed));
    } catch {
      setError('Can`t delete all completed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (titleToSet.trim() === '' || selectedTodoId === null) {
      return;
    }

    updateTodo(selectedTodoId, undefined, titleToSet);
    setTitleToSet('');
  };

  const handleDoubleClick = (todo: Todo) => {
    setSelectedTodoId(todo.id);
    setTitleToSet(todo.title);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelectedTodoId(null);
    }
  };

  const toggleAll = async () => {
    if (todos.length === 0) {
      return;
    }

    const shouldComplete = !allCompleted;

    setLoadingAll(true);
    setError(null);

    try {
      await Promise.all(todos.map(t => updateTodo(t.id, shouldComplete)));
    } catch (err) {
      setError("Can't update some todos");
    } finally {
      setLoadingAll(false);
    }
  };

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          <button
            type="button"
            className={classNames('todoapp__toggle-all', {
              active: allCompleted,
            })}
            data-cy="ToggleAllButton"
            onClick={toggleAll}
          />

          <form
            onSubmit={e => {
              e.preventDefault();
              addTodo(newTitle);
            }}
          >
            <input
              ref={inputRef}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
            />
          </form>
        </header>

        <section className="todoapp__main" data-cy="TodoList">
          {filteredTodos.map(todo => (
            <div
              data-cy="Todo"
              key={todo.id}
              className={classNames('todo', {
                completed: todo.completed,
              })}
            >
              <label className="todo__status-label">
                <input
                  data-cy="TodoStatus"
                  type="checkbox"
                  className="todo__status"
                  checked={todo.completed}
                  onChange={() => updateTodo(todo.id, !todo.completed)}
                />
                <span className="visually-hidden">Toggle todo</span>
              </label>

              {selectedTodoId === todo.id ? (
                <form
                  onSubmit={handleSubmit}
                  className="todo__title-field-container"
                >
                  <input
                    data-cy="TodoTitleField"
                    type="text"
                    className="todo__title-field"
                    value={titleToSet}
                    onChange={e => setTitleToSet(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                </form>
              ) : (
                <span
                  data-cy="TodoTitle"
                  className="todo__title"
                  onDoubleClick={() => handleDoubleClick(todo)}
                >
                  {todo.title}
                </span>
              )}

              <button
                type="button"
                className="todo__remove"
                data-cy="TodoDelete"
                onClick={() => deleteTodo(todo.id)}
              >
                ×
              </button>

              <div
                data-cy="TodoLoader"
                className={classNames('modal overlay', {
                  'is-active': loadingTodoId === todo.id || loadingAll,
                })}
              >
                <div className="modal-background has-background-white-ter" />
                <div className="loader" />
              </div>
            </div>
          ))}
        </section>

        {todos.length > 0 && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {`${remainingCount} item${remainingCount !== 1 ? 's' : ''} left`}
            </span>

            <nav className="filter" data-cy="Filter">
              <a
                href="#/"
                className={classNames('filter__link', {
                  selected: filter === 'all',
                })}
                data-cy="FilterLinkAll"
                onClick={() => setFilter('all')}
              >
                All
              </a>
              <a
                href="#/active"
                className={classNames('filter__link', {
                  selected: filter === 'active',
                })}
                data-cy="FilterLinkActive"
                onClick={() => setFilter('active')}
              >
                Active
              </a>
              <a
                href="#/completed"
                className={classNames('filter__link', {
                  selected: filter === 'completed',
                })}
                data-cy="FilterLinkCompleted"
                onClick={() => setFilter('completed')}
              >
                Completed
              </a>
            </nav>

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={!hasCompletedTodos}
              onClick={deleteCompletedTodos}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>
      <div
        data-cy="ErrorNotification"
        className={classNames(
          'notification is-danger is-light has-text-weight-normal',
          { hidden: !error },
        )}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={() => setError('')}
        />
        {error}
      </div>
    </div>
  );
};
